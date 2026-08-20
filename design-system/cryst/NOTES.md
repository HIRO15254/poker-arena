# Cryst Design System — 参照メモ

出典: Claude Design プロジェクト「Cryst Design System」(projectId: `6c0df305-076f-4746-a326-a80d8b2e731e`)。
完全なソース(コンポーネント JSX、ガイドライン、UI kit)はそちらが正。ここは実装時のローカル参照用抜粋。

## 要点

- Linear 風、shadcn/ui 変数名。**ダークファースト**(`.dark` が製品のホーム、`:root` はライト)。
- アクセントは青1色: `--primary` #3b82f6 (light) / #4593f8 (dark)。
- フォント: Noto Sans JP(400–700)+ JetBrains Mono(数値・ID・タイムスタンプは常に mono)。
- UI 基本 13px(`--text-sm`)、読み物 15px、メタ 11px。見出しは tracking -0.015em。
- スペーシング 4px ベース(2/6px 半歩あり)。コントロール高 28/32/36px(sm/md/lg)、モバイルは `xl`=40px。
- サイドバー 244px。フラットな面 + 1px ヘアライン区切り。グラデーション・テクスチャ禁止。
- 角丸: 4 内側 / 6 コントロール / 8 カード / 12 ダイアログ / full ピル。影は浮遊層のみ、ごく控えめ。
- モーション: 100/160/250ms、ease-out のみ。バウンス禁止。
- **Tabler Icons 必須**(webfont は CDN。アーティファクト内では inline SVG で Tabler 形状を再現)。絵文字禁止。メタデータは常に icon + text。
- コピー: 簡潔・断定調・sentence case。動詞始まりの短いラベル。感嘆符禁止。
- モバイルのフォームは BottomSheet(中央ダイアログはデスクトップのみ)。

## コンポーネント一覧

core: Icon / actions: Button, IconButton / forms: Input, Select, Checkbox, Radio, Switch /
display: Card, Badge, Tag / navigation: Tabs / overlay: Dialog, Tooltip, Toast, BottomSheet

主要レシピ(実測値):
- Button: 高さ 28/32/36/40、padding 0 10/12/16/18px、radius 6、gap 6px、font 11/13px medium。primary=青ベタ、secondary=card面+inputボーダー+shadow-sm、ghost=透明+muted-fg。
- Badge: 高さ 20px、padding 0 7px、radius full、11px medium。variant別に 15% 透過背景+同色文字(success/warning/destructive/info/primary/neutral)。
- Card: card面+border+radius 8+shadow-sm。head padding 16 16 0、title 15px semibold、body 16px padding 13px。
- Tabs(underline): padding 8 12、border-bottom 2px、active=primary下線+foreground。pill variant あり。
