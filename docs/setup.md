# Thermonitor セットアップ手順

温湿度監視システム Thermonitor の Docker 環境構築手順です。

---

## 必要な環境

- Docker 24以上
- Docker Compose v2以上

インストール済みか確認：

```bash
docker --version
docker compose version
```

---

## 1. ファイルの配置

プロジェクト一式を任意のディレクトリに配置してください。

```
thermo/
├── docker-compose.yml
├── .env               ← .env.example をコピーして作成
├── backend/
└── frontend/
```

---

## 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成します。

```bash
cp .env.example .env
```

`.env` を編集して各値を設定します。

```env
DB_HOST=db                  # 変更不要
DB_NAME=thermo_db           # 任意のDB名
DB_USER=thermo_user         # 任意のユーザー名
DB_PASS=your_password_here  # 任意のパスワード（強いものを設定）
SECRET_KEY=                 # 以下のコマンドで生成
```

`SECRET_KEY` の生成：

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### おんどとり WebStorage を使用する場合

おんどとり WebStorage の API 情報を追記します。

```env
API_KEY=（WebStorage APIキー）
LOGIN_ID=（WebStorageログインID）
LOGIN_PASS=（WebStorageログインパスワード）
```

---

## 3. 起動

```bash
docker compose up -d
```

初回起動時にデータベースのマイグレーションが自動で実行されます。

---

## 4. アクセス

ブラウザで以下にアクセスします。

```
http://サーバーのIPアドレス:8080
```

---

## 5. 初期ユーザーの作成

起動後、管理者ユーザーを作成します。

```bash
docker compose exec app python -c "
import os, psycopg2
from passlib.context import CryptContext
pwd = CryptContext(schemes=['bcrypt'])
conn = psycopg2.connect(host='db', dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'], password=os.environ['DB_PASS'])
cur = conn.cursor()
cur.execute(\"INSERT INTO users (username, hashed_password, role) VALUES (%s, %s, 'admin')\", ('admin', pwd.hash('changeme')))
conn.commit()
conn.close()
print('管理者ユーザーを作成しました。ユーザー名: admin / パスワード: changeme')
"
```

ログイン後すぐにパスワードを変更してください。

---

## 6. センサの登録

管理画面（`/admin`）からセンサを登録します。

| 項目 | 説明 |
|------|------|
| センサキー | デバイス識別子（例: `ondotori_1`） |
| センサ名 | 表示名（例: `倉庫1`) |

---

## 7. データ収集間隔の変更

管理画面の「システム設定」からデータ収集間隔（分）を変更できます。デフォルトは10分です。

---

## 8. 停止・再起動

```bash
# 停止
docker compose down

# 再起動
docker compose restart

# ログ確認
docker compose logs -f
```

---

## 9. データのバックアップ

```bash
docker compose exec db pg_dump -U thermo_user thermo_db > backup.sql
```

---

## トラブルシューティング

**ログイン画面が表示されない**
- コンテナの起動を確認: `docker compose ps`
- ポート8080が他のアプリと競合していないか確認

**データが収集されない**
- `.env` の API_KEY / LOGIN_ID / LOGIN_PASS を確認
- ログ確認: `docker compose logs monitor`

**DB接続エラー**
- `DB_HOST=db` になっているか確認（`localhost` は不可）
