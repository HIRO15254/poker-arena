"""アリーナ REST API のクライアント(stdlib のみ)。

ハンド履歴を引いて AI に読ませ、bot を直して再デプロイする——という
開発ループを回すための最小限のクライアント。

    from poker_arena import ArenaClient

    arena = ArenaClient(api_key="pa_...")
    for h in arena.hands(limit=200):
        if h["net"] < -30 * 100:          # 30bb 以上負けたハンド
            print(arena.hand(h["handId"]))

注意: 既定の ``urllib`` は ``User-Agent: Python-urllib/x.y`` を送るが、
この UA は CDN のボット対策に既知の自動化クライアントとして遮断される。
このクライアントは明示的に UA を設定するのでその問題を踏まない。
自前で HTTP を書く場合も UA を必ず設定すること。
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

DEFAULT_BASE_URL = "https://vcode-poker-arena.hiro15254.com"
USER_AGENT = "poker-arena-sdk/0.1 (python)"


class ArenaError(RuntimeError):
    """アリーナが 2xx 以外を返した。"""

    def __init__(self, status: int, error: str, message: str) -> None:
        super().__init__(f"{status} {error}: {message}")
        self.status = status
        self.error = error
        self.message = message


class ArenaClient:
    """アリーナ API の薄いラッパー。

    :param api_key: Web UI か ``POST /api/signup`` で発行した API キー。
        読み取り専用のエンドポイントだけを使うなら省略できる。
    :param base_url: 既定は本番。ローカル開発では ``http://localhost:8787``。
    :param timeout: 秒。
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    # --- HTTP ---------------------------------------------------------------

    def _request(self, method: str, path: str, body: Any = None, **query: Any) -> Any:
        url = self.base_url + path
        params = {k: v for k, v in query.items() if v is not None}
        if params:
            url += "?" + urllib.parse.urlencode(params)

        data = json.dumps(body).encode() if body is not None else None
        headers = {"user-agent": USER_AGENT, "accept": "application/json"}
        if data is not None:
            headers["content-type"] = "application/json"
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return json.loads(res.read().decode())
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode(errors="replace")
            try:
                payload = json.loads(raw)
                raise ArenaError(exc.code, payload.get("error", "http_error"), payload.get("message", raw)) from None
            except json.JSONDecodeError:
                raise ArenaError(exc.code, "http_error", raw[:200]) from None

    # --- 読み取り -----------------------------------------------------------

    def health(self) -> dict:
        return self._request("GET", "/api/health")

    def season(self) -> dict:
        """現在のシーズン設定(種目・スタック・ブラインド・レーキ・掲載条件)。"""
        return self._request("GET", "/api/season")

    def builtins(self) -> list[str]:
        """対戦できる組み込み戦略の一覧。"""
        return self._request("GET", "/api/builtins")["strategies"]

    def leaderboard(self) -> dict:
        return self._request("GET", "/api/leaderboard")

    def tables(self) -> list[dict]:
        return self._request("GET", "/api/tables")

    # --- 自分の bot ---------------------------------------------------------

    def me(self) -> dict:
        return self._request("GET", "/api/me")

    def my_bots(self) -> list[dict]:
        return self._request("GET", "/api/bots")

    def bot(self, bot_id: str) -> dict:
        """bot の詳細。自分の bot なら webhook の署名 secret と統計も含む。"""
        return self._request("GET", f"/api/bots/{bot_id}")

    def create_bot(
        self,
        name: str,
        *,
        webhook_url: str | None = None,
        builtin_strategy: str | None = None,
    ) -> dict:
        kind = "builtin" if builtin_strategy else "webhook"
        body: dict[str, Any] = {"name": name, "kind": kind}
        if webhook_url:
            body["webhookUrl"] = webhook_url
        if builtin_strategy:
            body["builtinStrategy"] = builtin_strategy
        return self._request("POST", "/api/bots", body)

    def deploy(
        self,
        bot_id: str,
        *,
        webhook_url: str | None = None,
        builtin_strategy: str | None = None,
        note: str | None = None,
    ) -> dict:
        """新しいバージョンをデプロイする。**シーズン成績はリセットされる**。"""
        body: dict[str, Any] = {}
        if webhook_url:
            body["webhookUrl"] = webhook_url
        if builtin_strategy:
            body["builtinStrategy"] = builtin_strategy
        if note:
            body["note"] = note
        return self._request("POST", f"/api/bots/{bot_id}/versions", body)

    def activate(self, bot_id: str) -> dict:
        return self._request("POST", f"/api/bots/{bot_id}/activate", {})

    def deactivate(self, bot_id: str) -> dict:
        return self._request("POST", f"/api/bots/{bot_id}/deactivate", {})

    # --- ハンド履歴 ---------------------------------------------------------

    def hands(self, bot_id: str | None = None, limit: int = 50) -> list[dict]:
        """自分視点のハンド履歴を新しい順で返す。bot_id 省略時は自分の全 bot。

        金額はチップ。bb にするには 100 で割る(``to_bb``)。
        """
        return self._request("GET", "/api/hands", None, botId=bot_id, limit=limit)["hands"]

    def hand(self, hand_id: str) -> dict:
        """1ハンドの詳細。相手のカードはショーダウンで公開された分だけ入る。"""
        return self._request("GET", f"/api/hands/{hand_id}")

    def test_match(self, bot_id: str, opponent: str, hands: int = 500, seed: int | None = None) -> dict:
        """レーティングに反映されないテスト対戦。"""
        body: dict[str, Any] = {"botId": bot_id, "opponent": opponent, "hands": hands}
        if seed is not None:
            body["seed"] = seed
        return self._request("POST", "/api/test-match", body)
