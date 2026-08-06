# 設計決定ドキュメント：計測データ管理システム
出雲村田製作所 向け　演習課題

リポジトリ：https://github.com/kurumasora/-thermo

---

## 1．システム概要
製造現場における温湿度変動が製品品質（MLCC）に直接影響するため，計測データをリアルタイムに監視し，異常を早期に検知・通知するシステムを設計・実装する．

---

## 2．前提条件
| 項目 | 内容 |
|---|---|
| センサ | おんどとり TR-71A2（温度 2ch，WiFi直結モデル） |
| データ蓄積 | おんどとり WebStorage（クラウド） |
| データ取得 | おんどとり WebStorage API |
| 実行環境 | さくらVPS（本番） / Docker（顧客配布用） |
| 開発体制 | 一人開発 |

---

## 3．確定技術スタック
| 層 | 技術 |
|---|---|
| センサ・データ取得 | おんどとり WebStorage API |
| バックエンド | FastAPI（Python） |
| フロントエンド | React（TypeScript） |
| DB | PostgreSQL |
| 定期実行 | cron + flock（本番） / monitor_loop.py 常駐プロセス（Docker） |
| 通知 | Microsoft Teams Webhook，メール（SMTP） |
| インフラ（本番） | さくらVPS + Nginx + Let's Encrypt |
| インフラ（配布） | Docker Compose（Nginx + FastAPI + PostgreSQL） |
| グラフ描画 | recharts（AreaChart，数値タイムスタンプ軸） |

---

## 4．機能要件
| ID | 機能 | 内容 |
|---|---|---|
| FR-01 | データ取得 | 共通インターフェース（IMeasurementDevice）経由で温度データを取得する |
| FR-02 | データ蓄積・管理 | cron実行時刻を全センサ共通タイムスタンプとしてPostgreSQLに保存する |
| FR-03 | 閾値異常検知 | 下限値 ≤ 計測値 ≤ 上限値 を外れた時点で即時アラートを発報する |
| FR-04 | 傾向異常検知 | 直近データに一次回帰を適用し，傾き（変化速度）が設定値を超えた場合に予兆アラートを発報する．実タイムスタンプを使った回帰とR²フィルター（デフォルト0.75）により誤検知を抑制する．閾値到達予測時刻を通知・履歴に表示する（ON/OFF切替可能） |
| FR-05 | 即時通知 | アラート発生時点でWebhook・メールにより即時通知する |
| FR-06 | ログイン認証 | ID・パスワードによるログイン認証を行い，未認証ユーザーはログイン画面のみ表示する |
| FR-07 | ロールベースアクセス制御 | 管理者と一般ユーザーでアクセスできる画面を制限する |
| FR-08 | ユーザー管理 | 管理者がユーザーの追加・削除・ロール変更・パスワードリセットを行える |
| FR-10 | データ収集間隔設定 | 管理画面からデータ収集間隔（分）をDB経由で動的に変更できる |
| FR-11 | CSV出力 | 計測データ・アラート履歴をCSVでダウンロードできる（UTF-8，RFC 5987対応） |
| FR-12 | 計測データフィルター | センサ・日付範囲で計測データ一覧を絞り込める |

---

## 5．非機能要件
| ID | 区分 | 内容 |
|---|---|---|
| NFR-01 | 拡張性 | センサ追加時に判定・通知の処理を変更しない設計とする |
| NFR-02 | 保守性 | 機能ごとにファイルを分割し，責務を明確にする |
| NFR-03 | 設定変更容易性 | 閾値・収集間隔はPostgreSQLで管理し，Web UIから変更可能とする |
| NFR-04 | 説明可能性 | 設計判断を言語化して説明できること |
| NFR-05 | テスト容易性 | 各モジュールを単独でテスト・動作確認できる構造とする |
| NFR-06 | セキュリティ | パスワードはハッシュ化してDBに保存し，平文では保持しない |
| NFR-07 | アクセス制限 | ログイン済みユーザーのみシステムにアクセスできる．アカウント発行は管理者が一元管理する |
| NFR-08 | 配布容易性 | Docker Composeで顧客環境に簡単にデプロイできる |

---

## 6．マスタ管理項目
以下の設定値はすべてPostgreSQLで管理し，プログラム内にハードコーディングしない．

### channel_config テーブル（チャンネルごと）
| 設定項目 | 用途 |
|---|---|
| 上限閾値 | 閾値異常判定の上限値 |
| 下限閾値 | 閾値異常判定の下限値 |
| 回帰傾き閾値 | 一次回帰の傾きの上限値 |
| 回帰対象データ数 | 回帰計算に使用する直近データの件数 |
| 傾向監視 ON/OFF | 傾向異常検知機能の有効・無効 |

### app_settings テーブル（システム全体）
| キー | 用途 |
|---|---|
| `monitor_interval_minutes` | データ収集間隔（分）．デフォルト10分 |

### その他
| 項目 | 管理場所 |
|---|---|
| ユーザー情報（ID・ハッシュ化パスワード・ロール） | users テーブル |
| Teams Webhook URL | sensors テーブル（センサごと） |
| SMTP設定 | smtp_config テーブル |

---

## 7．システム構成図

### 本番環境（さくらVPS）
```
【利用者】
ブラウザ（React）
    ↕ HTTPS（thermonitor.ahirukuma.cc）
Nginx（リバースプロキシ，SSL終端）
    ├─ / → React（静的ファイル，Nginxが配信）
    └─ /api/ → FastAPI :8100（uvicorn）
        ↕
PostgreSQL（計測データ・アラート履歴・ユーザー情報・設定）

【自動実行】
crontab（毎分） + flock（二重起動防止）
    → monitor.py
        ↓ app_settings から収集間隔を読み込み，未経過ならスキップ
        ↓ cron実行時刻を全センサ共通タイムスタンプとして使用
        ├─ おんどとり WebStorage API → 温度データ取得
        ↓ 閾値・傾向判定
        ├─ webhook.py → Microsoft Teams
        └─ email.py → メール通知
```

### Docker環境（顧客配布用）
```
【利用者】
ブラウザ
    ↕ HTTP :8080
Nginx コンテナ（静的ファイル配信 + /api/ プロキシ）
    └─ /api/ → app コンテナ :8000（uvicorn）
        ↕
db コンテナ（PostgreSQL）

【自動実行】
monitor コンテナ（monitor_loop.py 常駐）
    → 1分ごとに monitor.main() を呼び出し
    → 収集間隔はDBのapp_settingsで制御
```

---

## 8．タイムスタンプ設計方針
センサごとに取得タイムスタンプが異なると，テーブル表示で行が揃わない問題が発生する．
そのため，**cron実行時刻（`datetime.now()`）を全センサ共通タイムスタンプ**として使用する．

- センサAPIが返すタイムスタンプは無視する
- ondotoriのrssi（WiFi直結のTR-71A2では常に空）によるオフライン判定は行わない
- 1センサがオフラインでも他センサのデータ保存には影響しない

---

## 9．プロジェクトファイル構成
```
thermo/
├─ backend/
│   ├─ main.py                  # FastAPI アプリ本体
│   ├─ monitor.py               # cron で実行する監視スクリプト
│   ├─ monitor_loop.py          # Docker用常駐監視プロセス（1分ごとにmonitor.main()を呼ぶ）
│   ├─ interfaces.py            # IMeasurementDevice・MeasurementData 定義
│   ├─ db.py                    # DB接続（psycopg2）
│   ├─ Dockerfile
│   ├─ devices/
│   │   ├─ ondotori.py          # おんどとり取得処理
│   │   ├─ dummy_sensor.py      # テスト・開発用ダミーセンサ
│   │   └─ sensor_map.py        # センサキー → クラスのマッピング
│   ├─ judgement/
│   │   ├─ threshold.py         # 閾値異常判定
│   │   ├─ base.py              # 判定基底クラス
│   │   ├─ factory.py           # 判定クラスのファクトリ
│   │   └─ plugins/             # プラガブル判定アルゴリズム
│   │       ├─ linear.py        # 一次回帰（デフォルト）
│   │       ├─ polynomial.py    # 多項式回帰
│   │       ├─ rms.py           # RMS判定
│   │       └─ exponential_smoothing.py
│   ├─ notifiers/
│   │   ├─ webhook.py           # Teams Webhook 通知
│   │   └─ email.py             # メール通知（SMTP）
│   ├─ auth/
│   │   ├─ router.py            # ログイン・パスワード変更 API
│   │   └─ utils.py             # パスワードハッシュ化・JWT管理
│   ├─ routers/
│   │   ├─ settings.py          # 閾値・app_settings API
│   │   ├─ status.py            # 計測データ・アラート履歴・CSV出力 API
│   │   ├─ sensors.py           # センサ管理 API
│   │   ├─ admin.py             # ユーザー管理 API
│   │   └─ notification.py      # 通知設定（SMTP・Webhook）API
│   ├─ models/
│   │   ├─ device.py            # センサ関連Pydanticモデル
│   │   └─ measurement.py       # 計測データ関連Pydanticモデル
│   ├─ migrations/
│   │   ├─ 001_init.sql
│   │   ├─ 002_trend_predictions.sql
│   │   ├─ 003_sensor_generalization.sql
│   │   ├─ 004_sensor_webhook.sql
│   │   ├─ 005_email_notification.sql
│   │   ├─ 006_pluggable_judgement.sql
│   │   ├─ 007_drop_legacy_judgement_columns.sql
│   │   ├─ 008_drop_prediction_tables.sql
│   │   └─ 009_app_settings.sql
│   └─ requirements.txt
│
├─ frontend/
│   ├─ src/
│   │   ├─ App.tsx
│   │   ├─ types/
│   │   │   └─ dashboard.ts          # 型定義（Sensor, ChannelConfig 等）
│   │   ├─ pages/
│   │   │   ├─ Login.tsx             # ログイン画面
│   │   │   ├─ Dashboard.tsx         # 現在値カード・グラフ・計測テーブル
│   │   │   ├─ Alerts.tsx            # アラート履歴
│   │   │   ├─ Admin.tsx             # 管理画面（ユーザー・センサ・システム・閾値）
│   │   │   └─ ChangePassword.tsx    # パスワード変更画面
│   │   ├─ components/
│   │   │   ├─ Navbar.tsx            # ナビゲーションバー（sticky，ロール別，アンカーリンク）
│   │   │   ├─ RequireAuth.tsx       # ルートガード（JWT期限チェック）
│   │   │   ├─ dashboard/
│   │   │   │   ├─ ValueCard.tsx     # 現在値カード
│   │   │   │   ├─ SensorGraph.tsx   # 温湿度グラフ（時系列軸）
│   │   │   │   ├─ GraphControls.tsx # スコープ・日時範囲コントロール
│   │   │   │   └─ MeasurementTable.tsx # 計測データ一覧（フィルター・ページネーション）
│   │   │   └─ admin/
│   │   │       ├─ UserTab.tsx       # ユーザー管理タブ
│   │   │       ├─ SensorTab.tsx     # センサ管理タブ
│   │   │       ├─ ThresholdTab.tsx  # 閾値設定タブ
│   │   │       ├─ SystemTab.tsx     # システム設定タブ（収集間隔・SMTP）
│   │   │       ├─ NotificationTab.tsx # 通知設定タブ
│   │   │       ├─ Toast.tsx         # トースト通知コンポーネント
│   │   │       ├─ TogglePill.tsx    # ON/OFFトグルコンポーネント
│   │   │       └─ styles.ts         # 管理画面共通スタイル
│   │   ├─ utils/
│   │   │   └─ format.ts             # タイムスタンプ統一フォーマット関数
│   │   └─ api/
│   │       ├─ client.ts             # axiosインスタンス（401自動リダイレクト）
│   │       ├─ alerts.ts             # アラート履歴API
│   │       ├─ auth.ts               # 認証API
│   │       ├─ measurements.ts       # 計測データAPI
│   │       ├─ notification.ts       # 通知設定API
│   │       ├─ sensors.ts            # センサ管理API
│   │       ├─ settings.ts           # 閾値・システム設定API
│   │       └─ users.ts              # ユーザー管理API
│   ├─ Dockerfile
│   ├─ nginx.conf
│   ├─ package.json
│   └─ tsconfig.json
│
├─ tests/
│   ├─ test_threshold.py
│   ├─ test_trend.py
│   ├─ test_auth.py
│   ├─ test_cooldown.py
│   ├─ test_sensor_delete.py
│   └─ test_collection_timestamp.py
│
├─ scripts/
│   ├─ start_api.sh             # uvicorn起動スクリプト（crontab @reboot用）
│   ├─ migrate_app_settings.py  # app_settingsテーブル初期化スクリプト
│   ├─ insert_dummy.py          # 開発用ダミーデータ投入
│   ├─ check_ondotori.py        # おんどとりAPI接続確認
│   ├─ check_webhook.py         # Teams Webhook疎通確認
│   └─ check_email.py           # メール送信確認
│
├─ docs/
│   ├─ setup.md                 # Docker環境セットアップ手順書（顧客向け）
│   ├─ manual.md                # 操作マニュアル（画面構成・センサ追加・判定ロジック追加）
│   └─ design.md                # 設計決定ドキュメント
├─ README.md                    # プロジェクト概要・クイックスタート
├─ docker-compose.yml
├─ .env.example
└─ logs/
    ├─ monitor.log
    └─ uvicorn.log
```

---

## 10．センサ拡張の設計方針
新しいセンサを追加する際は，`devices/` 以下に実装クラスを1つ追加し，`sensor_map.py` にエントリを追記するだけでよい．判定・通知・Web UIのコードは変更不要とする．

```python
# interfaces.py
@dataclass
class MeasurementData:
    channel: int        # チャンネル番号
    value: float        # 計測値
    unit: str           # 単位（℃，% など）
    timestamp: str      # 取得時刻（monitor.pyが上書きするため初期値は不問）

class IMeasurementDevice(ABC):
    @abstractmethod
    def get_data(self) -> list[MeasurementData]:
        pass
```

| ファイル | 変更要否 |
|---|---|
| `devices/新センサ.py` | 追加（新規作成のみ） |
| `devices/sensor_map.py` | センサキーとクラスのマッピングを追記 |
| `judgement/threshold.py` | 変更不要 |
| `notifiers/webhook.py` | 変更不要 |
| `frontend/` | 変更不要 |

---

## 11．画面構成とアクセス権限
| パス | 画面 | アクセス権限 |
|---|---|---|
| `/login` | ログイン画面 | 全員（未認証） |
| `/` | ダッシュボード（現在値カード・グラフ・計測データ一覧） | ログイン済み全員 |
| `/alerts` | アラート履歴 | ログイン済み全員 |
| `/change-password` | パスワード変更 | ログイン済み全員 |
| `/admin` | 管理画面（ユーザー・センサ・閾値・システム設定） | 管理者のみ |

### 管理画面（/admin）タブ構成
| タブ | 内容 |
|---|---|
| ユーザー管理 | ユーザーの追加・削除・ロール変更・パスワードリセット |
| センサ管理 | センサ・チャンネルの追加・編集・有効化/無効化 |
| 閾値設定 | チャンネルごとの上限・下限閾値，傾向監視ON/OFF |
| システム設定 | データ収集間隔（分）の変更 |
| 通知設定 | SMTP設定，センサごとのWebhook URL・メール通知先 |

### アカウント発行ポリシー
- 自由登録画面は設けない
- アカウントは管理者が `/admin` から一元管理する

---

## 12．インフラ構成

### 本番環境
| 項目 | 内容 |
|---|---|
| サーバー | さくらVPS |
| リバースプロキシ | Nginx |
| ドメイン | thermonitor.ahirukuma.cc |
| HTTPS | Let's Encrypt（certbot） |
| 外部公開ポート | 443（HTTPS） |
| 内部ポート | FastAPI :8100，PostgreSQL :5432（外部非公開） |
| uvicorn自動起動 | crontab @reboot → scripts/start_api.sh |
| データ収集 | crontab 毎分 + flock，間隔はDB設定で制御 |

### Docker環境（顧客配布用）
| 項目 | 内容 |
|---|---|
| 公開ポート | :8080（HTTP） |
| 構成 | nginx / app / monitor / db の4コンテナ |
| マイグレーション | 起動時に docker-entrypoint.sh が自動実行 |
| データ収集 | monitor コンテナが monitor_loop.py を常駐実行 |

---

## 13．ブランチ戦略
```
main          # 本番環境に反映するコード（常に動く状態を保つ）
develop       # 開発の統合ブランチ
feature/xxx   # 機能ごとの作業ブランチ
fix/xxx       # バグ修正ブランチ
docs          # ドキュメント整備ブランチ
```

---

## 14．見送り事項と理由
| 項目 | 理由 |
|---|---|
| Next.js | 今回の設定画面程度の用途ではオーバースペック |
| Django | フルスタックフレームワークは今回の規模に対して過剰 |
| ユーザー自由登録 | 社内システムのためアカウント発行は管理者が一元管理する |
| 傾向予測精度追跡（FR-09） | 実運用での有用性が見えないため削除 |

---

## 改訂履歴
| 版 | 日付 | 内容 |
|---|---|---|
| 1.0 | 2026-04-30 | 初版作成 |
| 1.1 | 2026-06-23 | 技術スタック（FastAPI + React）確定，ファイル構成・拡張方針を追加 |
| 1.2 | 2026-06-23 | ログイン認証・ロールベースアクセス制御・ユーザー管理要件を追加，インフラ構成を追加 |
| 1.3 | 2026-06-30 | ナビゲーションバー・ルートガード・axiosインターセプター実装，HTTPS・uvicorn起動設定，傾向異常の閾値到達予測表示 |
| 1.4 | 2026-07-23 | 温度推移グラフ（recharts）・現在値カード追加，アラート履歴フィルター追加 |
| 1.5 | 2026-07-25 | アラート履歴を別タブページに分離，パスワード変更画面追加，タイムスタンプ表示統一，傾向判定を実時刻回帰・R²フィルターに改善 |
| 1.6 | 2026-08-04 | タイムスタンプ設計をcron収集時刻に統一，ondotoriオフライン検出修正（rssi廃止），収集間隔のDB動的設定追加，グラフX軸を時系列軸に修正，CSVのUTF-8ファイル名対応，ナビバーsticky化・アンカーリンク追加，計測データ一覧フィルター追加，Docker対応（monitor_loop.py・009_app_settings.sql），docs/setup.md・README.md追加，design.mdをdocs/に移動，ファイル構成を実装に合わせて全面修正 |
