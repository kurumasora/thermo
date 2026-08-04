# Thermonitor

製造現場の温湿度を監視し，異常を早期に検知・通知するシステムです．

## 技術スタック

| 層 | 技術 |
|---|---|
| バックエンド | FastAPI（Python） |
| フロントエンド | React（TypeScript） |
| DB | PostgreSQL |
| 通知 | Microsoft Teams Webhook，メール（SMTP） |
| インフラ | Docker Compose / さくらVPS + Nginx |

## クイックスタート

```bash
cp .env.example .env
# .env を編集して各値を設定
docker compose up -d
```

ブラウザで `http://localhost:8080` にアクセスしてください．

詳細なセットアップ手順は [docs/setup.md](docs/setup.md) を参照してください．

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/setup.md](docs/setup.md) | Docker環境セットアップ手順 |
| [docs/design.md](docs/design.md) | 設計決定ドキュメント |

## 主な機能

- 温湿度データのリアルタイム監視・グラフ表示
- 閾値異常・傾向異常の検知とアラート通知
- 計測データ・アラート履歴のCSVダウンロード
- ロールベースアクセス制御（管理者 / 一般ユーザー）
- データ収集間隔のWeb UI上での動的変更
