# 設計決定ドキュメント：計測データ管理システム
出雲村田製作所 向け　演習課題

---

## 1．システム概要
製造現場における温湿度変動が製品品質（MLCC）に直接影響するため，計測データをリアルタイムに監視し，異常を早期に検知・通知するシステムを設計・実装する．

---

## 2．前提条件
| 項目 | 内容 |
|---|---|
| センサ | おんどとり TR-7（温度 2ch） |
| データ蓄積 | おんどとり WebStorage（クラウド） |
| データ取得 | おんどとり WebStorage API |
| 実行環境 | さくらVPS |
| 開発体制 | 一人開発 |

---

## 3．確定技術スタック
| 層 | 技術 |
|---|---|
| センサ・データ取得 | おんどとり WebStorage API |
| バックエンド | FastAPI（Python） |
| フロントエンド | React（TypeScript） |
| DB | PostgreSQL |
| 定期実行 | cron |
| 通知 | Microsoft Teams Webhook |
| インフラ | さくらVPS + Nginx |

---

## 4．機能要件
| ID | 機能 | 内容 |
|---|---|---|
| FR-01 | データ取得 | 共通インターフェース（IMeasurementDevice）経由で温度データを取得する |
| FR-02 | データ蓄積・管理 | タイムスタンプ付きで時系列データをPostgreSQLに保存する |
| FR-03 | 閾値異常検知 | 下限値 ≤ 計測値 ≤ 上限値 を外れた時点で即時アラートを発報する |
| FR-04 | 傾向異常検知 | 直近データに一次回帰を適用し，傾き（変化速度）が設定値を超えた場合に予兆アラートを発報する．実タイムスタンプを使った回帰とR²フィルター（デフォルト0.75）により誤検知を抑制する．閾値到達予測時刻（例：約33分後 2026/07/25 05:15）を通知・履歴に表示する（ON/OFF切替可能） |
| FR-09 | 予測精度追跡 | 傾向異常発報時に予測到達時刻をDBに保存し，予測時刻到達後に実測値と照合して「的中／外れ」を自動記録する．管理者は精度レポート画面で的中率・予測履歴を確認できる（ON/OFF切替可能） |
| FR-05 | 即時通知 | アラート発生時点でWebhookにより即時通知する |
| FR-06 | ログイン認証 | ID・パスワードによるログイン認証を行い，未認証ユーザーはログイン画面のみ表示する |
| FR-07 | ロールベースアクセス制御 | 管理者と一般ユーザーでアクセスできる画面を制限する |
| FR-08 | ユーザー管理 | 管理者がユーザーの追加・削除・ロール変更・パスワードリセットを行える |

---

## 5．非機能要件
| ID | 区分 | 内容 |
|---|---|---|
| NFR-01 | 拡張性 | センサ追加時に判定・通知の処理を変更しない設計とする |
| NFR-02 | 保守性 | 機能ごとにファイルを分割し，責務を明確にする |
| NFR-03 | 設定変更容易性 | 閾値・管理限界値はPostgreSQLで管理し，Web UIから変更可能とする |
| NFR-04 | 説明可能性 | 設計判断を言語化して説明できること |
| NFR-05 | テスト容易性 | 各モジュールを単独でテスト・動作確認できる構造とする |
| NFR-06 | セキュリティ | パスワードはハッシュ化してDBに保存し，平文では保持しない |
| NFR-07 | アクセス制限 | ログイン済みユーザーのみシステムにアクセスできる．アカウント発行は管理者が一元管理する |

---

## 6．マスタ管理項目
以下の設定値はすべてPostgreSQLで管理し，プログラム内にハードコーディングしない．

### master_config テーブル（チャンネルごと）
| 設定項目 | 用途 |
|---|---|
| 上限閾値 | 閾値異常判定の上限値 |
| 下限閾値 | 閾値異常判定の下限値 |
| 回帰傾き閾値 | 一次回帰の傾きの上限値（℃/10分） |
| 回帰対象データ数 | 回帰計算に使用する直近データの件数 |
| 傾向監視 ON/OFF | 傾向異常検知機能の有効・無効 |

### system_settings テーブル（システム全体）
| キー | 用途 |
|---|---|
| `prediction_tracking` | 傾向予測の精度追跡機能の有効・無効（管理者がUIから切替） |

### その他
| 項目 | 管理場所 |
|---|---|
| ユーザー情報（ID・ハッシュ化パスワード・ロール） | users テーブル |
| Teams Webhook URL | .env（コードにハードコーディングしない） |

---

## 7．システム構成図
```
【利用者】
ブラウザ（React）
    ↕ HTTPS（サブドメイン経由）
Nginx（リバースプロキシ）
    ├─ / → React（静的ファイル配信）
    └─ /api/ → FastAPI :8100
        ↕
PostgreSQL（マスタ・アラート履歴・ユーザー情報・予測記録）

【自動実行】
cron → monitor.py
    ↓ マスタ読み込み
PostgreSQL
    ↓ 判定
threshold.py / trend.py
    ↓ アラート検知時
    ├─ webhook.py → Microsoft Teams
    └─ prediction.py → trend_predictions テーブルに予測保存・検証
```

---

## 8．プロジェクトファイル構成
```
project/
├─ backend/
│   ├─ main.py                  # FastAPI アプリ本体
│   ├─ monitor.py               # cron で実行する監視スクリプト
│   ├─ interfaces.py            # IMeasurementDevice 定義
│   ├─ db.py                    # DB接続（psycopg2）
│   ├─ devices/
│   │   └─ ondotori.py          # おんどとり取得処理
│   ├─ judgement/
│   │   ├─ threshold.py         # 閾値異常判定
│   │   ├─ trend.py             # 傾向異常判定（実時刻回帰・R²フィルター）
│   │   └─ prediction.py        # 予測保存・検証ロジック
│   ├─ notification/
│   │   └─ webhook.py           # Webhook 通知
│   ├─ auth/
│   │   ├─ router.py            # ログイン・パスワード変更 API
│   │   └─ utils.py             # パスワードハッシュ化・JWT管理
│   ├─ routers/
│   │   ├─ settings.py          # 閾値設定の API エンドポイント
│   │   ├─ status.py            # 現在値・アラート履歴の API
│   │   ├─ admin.py             # ユーザー管理の API エンドポイント
│   │   └─ prediction.py        # 予測精度レポート・ON/OFF切替 API
│   ├─ migrations/
│   │   └─ 002_trend_predictions.sql  # trend_predictions・system_settings テーブル
│   └─ requirements.txt
│
├─ frontend/
│   ├─ src/
│   │   ├─ App.tsx
│   │   ├─ pages/
│   │   │   ├─ Login.tsx             # ログイン画面
│   │   │   ├─ Dashboard.tsx         # 現在値カード・温度グラフ・計測テーブル
│   │   │   ├─ Alerts.tsx            # アラート履歴（フィルター・ページネーション）
│   │   │   ├─ Settings.tsx          # 閾値設定画面
│   │   │   ├─ Admin.tsx             # ユーザー管理画面
│   │   │   ├─ ChangePassword.tsx    # パスワード変更画面
│   │   │   └─ PredictionReport.tsx  # 傾向予測 精度レポート画面
│   │   ├─ components/
│   │   │   ├─ Navbar.tsx            # ナビゲーションバー（ロール別表示制御）
│   │   │   └─ RequireAuth.tsx       # ルートガード（JWT期限チェック）
│   │   ├─ utils/
│   │   │   └─ format.ts             # タイムスタンプ統一フォーマット関数
│   │   └─ api/
│   │       └─ client.ts             # axiosインスタンス（401自動リダイレクト）
│   ├─ package.json
│   └─ tsconfig.json
│
├─ test_alert.py                # アラート通知テストスクリプト
└─ monitor.log                  # 監視ログ（.gitignore対象）
```

---

## 9．センサ拡張の設計方針
新しいセンサを追加する際は，`devices/` 以下に実装クラスを1つ追加するだけでよい．判定・通知・Web UIのコードは変更不要とする．

```python
# interfaces.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class MeasurementData:
    channel: int        # チャンネル番号
    value: float        # 計測値
    unit: str           # 単位（℃，dB，% など）
    timestamp: str      # 取得時刻

class IMeasurementDevice(ABC):
    @abstractmethod
    def get_data(self) -> list[MeasurementData]:
        pass
```

| ファイル | 変更要否 |
|---|---|
| `devices/新センサ.py` | 追加（新規作成のみ） |
| `judgement/threshold.py` | 変更不要 |
| `judgement/trend.py` | 変更不要 |
| `notification/webhook.py` | 変更不要 |
| `frontend/` | 変更不要 |

---

## 10．画面構成とアクセス権限
| パス | 画面 | アクセス権限 |
|---|---|---|
| `/login` | ログイン画面 | 全員（未認証） |
| `/` | ダッシュボード（現在値カード・温度グラフ・計測テーブル） | ログイン済み全員 |
| `/alerts` | アラート履歴（種別・チャンネルフィルター，ページネーション） | ログイン済み全員 |
| `/change-password` | パスワード変更 | ログイン済み全員 |
| `/settings` | 閾値設定画面 | 管理者のみ |
| `/admin` | ユーザー管理画面 | 管理者のみ |
| `/prediction` | 傾向予測 精度レポート | 管理者のみ |

### ユーザー管理画面（/admin）でできること
| 操作 | 内容 |
|---|---|
| ユーザー追加 | ID・初期パスワード・ロールを設定して登録 |
| ユーザー削除 | アカウントの削除 |
| ロール変更 | 管理者／一般の切り替え |
| パスワードリセット | 仮パスワードを発行（現在のパスワードは参照不可） |

### アカウント発行ポリシー
- 自由登録画面は設けない
- アカウントは管理者が `/admin` から一元管理する
- 初期管理者アカウントはシステム導入時に開発者が作成する

---

## 11．インフラ構成
| 項目 | 内容 |
|---|---|
| サーバー | さくらVPS |
| リバースプロキシ | Nginx |
| ドメイン | サブドメイン（例：thermo.example.com） |
| HTTPS | Let's Encrypt（certbot） |
| 外部公開ポート | 80（HTTP），443（HTTPS） |
| 内部ポート | FastAPI :8100，PostgreSQL :5432（外部非公開） |
| クローラー対策 | robots.txt（全クロール拒否） |

---

## 12．実装ステップ
| Step | 内容 |
|---|---|
| 1 | FastAPI で閾値を返す API を1本作る |
| 2 | React からそのAPIを叩いて画面に表示する |
| 3 | フォームから閾値を更新できるようにする |
| 4 | monitor.py と PostgreSQL を繋げる |
| 5 | 通知（Webhook）を実装する |
| 6 | ログイン認証・ロールベースアクセス制御を実装する |
| 7 | ユーザー管理画面を実装する |

---

## 13．見送り事項と理由
| 項目 | 理由 |
|---|---|
| Docker | 一人開発・さくらVPS1台・3サービスの規模では不要．複数人開発や環境が増えた際に改めて検討する |
| Next.js | 今回の設定画面程度の用途ではオーバースペック |
| Django | フルスタックフレームワークは今回の規模に対して過剰 |
| ユーザー自由登録 | 社内システムのためアカウント発行は管理者が一元管理する |

---

## 14．開発フロー

### ブランチ戦略
```
main          # 本番環境に反映するコード（常に動く状態を保つ）
develop       # 開発の統合ブランチ
feature/xxx   # 機能ごとの作業ブランチ（作業後はdevelopにマージ）
```

### 作業の流れ
```
1. developから feature/xxx ブランチを切る
2. 機能を実装する
3. developにマージする
4. developが安定したらmainにマージする
```

### featureブランチ一覧
| ブランチ名 | 内容 |
|---|---|
| `feature/db-schema` | DBテーブル設計 |
| `feature/ondotori` | データ取得（fetch.pyの移植） |
| `feature/threshold` | 閾値異常判定 |
| `feature/trend` | 一次回帰・傾向検知 |
| `feature/webhook` | Teams通知 |
| `feature/auth` | ログイン・セッション管理 |
| `feature/dashboard` | ダッシュボード画面 |
| `feature/settings` | 閾値設定画面 |
| `feature/admin` | ユーザー管理画面 |

---

## 15．パッケージ管理

### 管理場所の対応
| 管理方法 | 対象 |
|---|---|
| `apt` | OS・サーバーソフトウェア |
| `.venv` + `pip` | Pythonライブラリ |
| `npm` | JavaScriptライブラリ |

### aptでインストールするもの（システムパッケージ）
| パッケージ | 用途 |
|---|---|
| `postgresql` | DBサーバー本体 |
| `nodejs` | Reactのビルド環境 |
| `nginx` | Webサーバー・リバースプロキシ |
| `certbot` | SSL証明書（Let's Encrypt） |
| `python3-certbot-nginx` | certbotのNginxプラグイン |

### .venvでインストールするもの（Pythonライブラリ）
| パッケージ | 用途 |
|---|---|
| `fastapi` | バックエンドフレームワーク |
| `uvicorn` | FastAPIの実行サーバー |
| `sqlalchemy` | ORM（DBテーブル操作） |
| `asyncpg` | PostgreSQL接続 |
| `python-dotenv` | .envファイルの読み込み |
| `requests` | おんどとりAPI接続 |
| `passlib` | パスワードハッシュ化 |
| `python-jose` | セッション管理 |
| `numpy` | 一次回帰計算 |

### npmでインストールするもの（JavaScriptライブラリ）
| パッケージ | 用途 |
|---|---|
| `react` | UIフレームワーク |
| `typescript` | 型付きJavaScript |
| `axios` | FastAPIへのHTTPリクエスト |
| `react-router-dom` | 画面遷移管理 |
| `jwt-decode` | フロントエンドでのJWTデコード・期限チェック |
| `recharts` | 温度推移グラフの描画 |

---

## 改訂履歴
| 版 | 日付 | 内容 |
|---|---|---|
| 1.0 | 2026-04-30 | 初版作成 |
| 1.1 | 2026-06-23 | 技術スタック（FastAPI + React）確定，ファイル構成・拡張方針を追加 |
| 1.2 | 2026-06-23 | ログイン認証・ロールベースアクセス制御・ユーザー管理要件を追加，インフラ構成を追加 |
| 1.3 | 2026-06-30 | ナビゲーションバー・ルートガード・axiosインターセプター実装，HTTPS・robots.txt・uvicorn systemd化完了，傾向異常の閾値到達予測をダッシュボードに表示，ダッシュボードの自動更新・ページネーション追加，自己削除・自己降格防止，DBコネクションリーク修正，monitor.pyエラーログ追加 |
| 1.4 | 2026-07-23 | 温度推移グラフ（recharts）・現在値カード追加，リクエスト前のJWTトークン期限チェック実装，アラート履歴フィルター（種別・チャンネル）追加 |
| 1.5 | 2026-07-25 | アラート履歴を別タブページ（/alerts）に分離，パスワード変更画面（/change-password）追加，全タイムスタンプ表示を YYYY/MM/DD HH:mm 形式に統一（format.ts），ポート8000→8100変更，傾向異常の予測表示をステップ→時刻（例：約33分後 2026/07/25 05:15）に変更，傾向判定を実タイムスタンプ回帰・R²フィルター（0.75）に改善（誤検知抑制），傾向予測精度追跡機能追加（trend_predictionsテーブル・精度レポート画面 /prediction・管理者のみON/OFF切替），傾向判定のデータ並び順バグ修正・下降傾向の到達予測閾値バグ修正 |
