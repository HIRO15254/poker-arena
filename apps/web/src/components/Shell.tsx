/** サイドバー付きのアプリシェル。全ページ共通。 */

import { NavLink, Outlet } from "react-router-dom";
import { getOwnerName } from "../api";
import { initials } from "../format";
import { IconCards, IconEye, IconHistory, IconRobot, IconTrophy } from "./Icons";

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? "nav on" : "nav";
}

export function Shell() {
  const owner = getOwnerName();

  return (
    <div className="app">
      <nav className="side" aria-label="メインナビゲーション">
        <div className="brand">
          Poker Arena
          <span className="bdg bdg-outline">仮称</span>
        </div>

        <div className="slabel">対戦</div>
        <NavLink to="/" end className={navClass}>
          <IconTrophy className="icn" />
          リーダーボード
        </NavLink>
        <NavLink to="/play" className={navClass}>
          <IconCards className="icn" />
          プレイ
        </NavLink>
        <NavLink to="/tables" className={navClass}>
          <IconEye className="icn" />
          ライブテーブル
        </NavLink>

        <div className="slabel">開発</div>
        <NavLink to="/bots" className={navClass}>
          <IconRobot className="icn" />
          マイbot
        </NavLink>
        <NavLink to="/hands" className={navClass}>
          <IconHistory className="icn" />
          ハンドリプレイヤー
        </NavLink>

        <div className="spacer" />

        <NavLink to="/bots" className="nav">
          <span className="avt">{owner ? initials(owner) : "??"}</span>
          <span className="mono truncate" style={{ fontSize: 12 }}>
            {owner ?? "未サインイン"}
          </span>
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
