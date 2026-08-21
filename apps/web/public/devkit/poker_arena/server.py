"""A zero-dependency webhook server for a Poker Arena bot.

    from poker_arena import Bot, serve
    serve(MyBot(), port=8080, secret="...")

Built on :mod:`http.server`, so there is nothing to install.  It:

* answers ``POST /`` (any path) with the JSON :class:`ActResponse`,
* verifies the ``X-Arena-Signature: sha256=<hex>`` HMAC when a secret is set,
* clamps out-of-range raises into the legal range instead of letting the arena
  coerce them to check/fold,
* **never** returns 500 for a strategy bug: any exception inside ``act()`` is
  caught and answered with check-if-legal-otherwise-fold,
* answers ``GET /health`` with ``{"ok": true}``.

It is single-purpose and fine for real traffic (one hand at a time per table),
but if you already run a web framework, reuse :func:`handle_request` and keep
your own HTTP layer.
"""

from __future__ import annotations

import hmac
import json
import sys
import traceback
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .bot import BotLike, Request, as_callable
from .types import ActRequest, ActResponse

__all__ = [
    "serve",
    "handle_request",
    "normalize_response",
    "sign_body",
    "verify_signature",
    "SIGNATURE_HEADER",
    "make_handler",
]

SIGNATURE_HEADER = "X-Arena-Signature"
#: Bodies larger than this are rejected outright; a real ActRequest is ~1KB.
MAX_BODY_BYTES = 256 * 1024


def sign_body(secret: str, body: bytes) -> str:
    """The ``sha256=<hex>`` signature the arena sends. Handy for local curl tests."""
    digest = hmac.new(secret.encode("utf-8"), body, sha256).hexdigest()
    return f"sha256={digest}"


def verify_signature(secret: str, body: bytes, header: str | None) -> bool:
    """Constant-time check of ``X-Arena-Signature`` against the raw request body."""
    if not header:
        return False
    return hmac.compare_digest(sign_body(secret, body), header.strip())


def normalize_response(response: Any, req: Request) -> ActResponse:
    """Coerce whatever the bot returned into a legal :class:`ActResponse`.

    The arena does *not* clamp: a raise outside ``[min, max]`` is treated as
    invalid and becomes check/fold.  Here it is clamped instead, and anything
    unrecognisable falls back to check-if-legal-otherwise-fold.
    """
    if not isinstance(response, dict):
        return req.fallback()
    action = response.get("action")
    if action == "raise":
        if not req.can_raise:
            return req.fallback()
        try:
            amount = int(response["amount"])
        except (KeyError, TypeError, ValueError):
            return req.fallback()
        return {"action": "raise", "amount": max(req.min_raise, min(req.max_raise, amount))}
    if action in ("fold", "check", "call"):
        if req.legal(action) is not None:
            return {"action": action}
        return req.fallback()
    return req.fallback()


def handle_request(bot: BotLike, payload: ActRequest) -> ActResponse:
    """Run ``bot`` against one decoded ActRequest and return a legal response.

    No HTTP involved — use it in tests and local replays::

        resp = handle_request(MyBot(), json.load(open("hand.json")))
    """
    req = Request(payload)
    act = as_callable(bot)
    try:
        return normalize_response(act(req), req)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return req.fallback()


def make_handler(bot: BotLike, secret: str | None, log: bool) -> type[BaseHTTPRequestHandler]:
    """Build the ``BaseHTTPRequestHandler`` subclass used by :func:`serve`."""
    act = as_callable(bot)

    class Handler(BaseHTTPRequestHandler):
        server_version = "poker-arena-sdk/0.1"
        protocol_version = "HTTP/1.1"

        def _send_json(self, status: int, body: dict[str, Any]) -> None:
            encoded = json.dumps(body, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self) -> None:  # noqa: N802 - http.server API
            self._send_json(200, {"ok": True})

        def do_POST(self) -> None:  # noqa: N802 - http.server API
            try:
                length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                length = 0
            if length <= 0 or length > MAX_BODY_BYTES:
                self._send_json(400, {"error": "invalid_request"})
                return
            body = self.rfile.read(length)

            if secret is not None and not verify_signature(
                secret, body, self.headers.get(SIGNATURE_HEADER)
            ):
                self._send_json(401, {"error": "bad_signature"})
                return

            try:
                payload = json.loads(body)
                req = Request(payload)
                req.legal_actions  # fail fast on a malformed body
            except Exception:
                self._send_json(400, {"error": "invalid_request"})
                return

            # From here on we always answer 200 with a legal action: a crash in
            # strategy code must not cost the hand.
            try:
                response = normalize_response(act(req), req)
            except Exception:
                traceback.print_exc(file=sys.stderr)
                response = req.fallback()

            if log:
                sys.stderr.write(
                    f"[{req.hand_id}] {req.street} {' '.join(req.hole_cards)} "
                    f"| {' '.join(req.board) or '-'} pot={req.pot} "
                    f"to_call={req.to_call} -> {response}\n"
                )
            self._send_json(200, dict(response))

        def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003
            pass  # the per-hand line above is more useful than an access log

    return Handler


def serve(
    bot: BotLike,
    port: int = 8080,
    secret: str | None = None,
    host: str = "0.0.0.0",
    log: bool = True,
) -> None:
    """Serve ``bot`` over HTTP until interrupted.

    :param bot: a :class:`~poker_arena.bot.Bot` or any ``callable(Request)``.
    :param port: TCP port to listen on.
    :param secret: the bot's arena secret.  When set, requests without a valid
        ``X-Arena-Signature`` are rejected with 401.  **Always set it in
        production** — read it from the environment, never hard-code it.
    :param host: bind address.
    :param log: print one line per action to stderr.
    """
    handler = make_handler(bot, secret, log)
    httpd = ThreadingHTTPServer((host, port), handler)
    httpd.daemon_threads = True
    name = getattr(bot, "name", bot.__class__.__name__)
    guard = "signed" if secret else "UNSIGNED (set secret= before going live)"
    sys.stderr.write(f"poker-arena bot '{name}' listening on {host}:{port} [{guard}]\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("\nshutting down\n")
    finally:
        httpd.server_close()
