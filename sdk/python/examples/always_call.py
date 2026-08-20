"""The smallest possible bot: never folds, never raises.

Run it:

    cd sdk/python && python3 -m examples.always_call

Then point your arena bot's webhook at it (see ../README.md).
It loses money — it is here to prove the plumbing works.
"""

from poker_arena import Bot, Request, ActResponse, call, check, serve


class AlwaysCall(Bot):
    name = "always-call"

    def act(self, req: Request) -> ActResponse:
        # `can_check` is true exactly when nothing is owed. Checking is free;
        # calling is not, so never call when a check is available.
        if req.can_check:
            return check()
        return call()


if __name__ == "__main__":
    # secret=None means signatures are not verified — fine locally, never live.
    serve(AlwaysCall(), port=8080)
