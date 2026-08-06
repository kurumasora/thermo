# Thermonitor 操作マニュアル

温湿度監視システム Thermonitor の画面構成・操作方法と、開発者向けの拡張方法（センサ追加・判定ロジック追加）をまとめたマニュアルです。

セットアップ（Docker起動）は [setup.md](setup.md)、設計上の判断理由は [design.md](design.md) を参照してください。

---

## 目次

1. [UI画面構成](#1-ui画面構成)
2. [各画面の機能](#2-各画面の機能)
3. [センサ追加方法](#3-センサ追加方法)
4. [閾値判定ロジック追加方法](#4-閾値判定ロジック追加方法)
5. [その他の重要事項](#5-その他の重要事項)

---

## 1. UI画面構成

ログイン後、左側にサイドバー（ナビゲーション）が常時表示されます。表示される項目はロール（管理者／一般ユーザー）によって変わります。

```
ログイン画面
    │ 認証成功
    ▼
┌─────────────────────────────────┐
│ サイドバー          │  各画面      │
│ ┌───────────────┐ │              │
│ │ ダッシュボード │ │ ダッシュボード（/）│
│ │ アラート履歴   │ │ アラート履歴（/alerts）│
│ │ 管理 ※管理者のみ│ │ 管理（/admin）│
│ │  ├ センサ管理  │ │  ├ センサタブ │
│ │  ├ 閾値設定    │ │  ├ 閾値タブ  │
│ │  ├ ユーザー管理│ │  ├ ユーザータブ│
│ │  ├ 通知設定    │ │  ├ 通知タブ  │
│ │  └ システム設定│ │  └ システムタブ│
│ ├───────────────┤ │              │
│ │ パスワード変更 │ │ パスワード変更（/change-password）│
│ │ ログアウト     │ │              │
│ └───────────────┘ │              │
└─────────────────────────────────┘
```

- 「管理」メニューは `role = admin` のユーザーにしか表示されません（一般ユーザーがURLを直接叩いても、APIレベルで403エラーになります）。
- 「管理」画面内は5つのタブ（センサ管理／閾値設定／ユーザー管理／通知設定／システム設定）に分かれています。

---

## 2. 各画面の機能

### 2.1 ログイン画面

- ユーザー名・パスワードを入力してログインします。
- 認証成功でJWTトークンをブラウザの`localStorage`に保存し、以後のAPI呼び出しに使用します。
- **トークンの有効期限は60分**です。期限が切れると自動的にログイン画面へ戻されます（`RequireAuth`コンポーネントが期限をチェック）。

### 2.2 ダッシュボード（`/`）

温湿度の監視画面です。

| 要素 | 内容 |
|---|---|
| 現在値カード | センサ・チャンネルごとの最新値を表示。閾値を超えている場合は赤く強調表示 |
| 異常バナー | 1つでも閾値超過のチャンネルがあれば画面上部に警告表示 |
| グラフ期間コントロール | 1時間／12時間／24時間／3日／7日／30日のプリセット切替、または日時範囲を直接指定（カレンダーモード） |
| センサグラフ | センサごとの時系列グラフ（recharts）。上限・下限閾値のラインも表示 |
| 計測データ一覧 | センサ・日付範囲で絞り込み可能なテーブル、ページネーション付き |
| CSVダウンロード | 一覧表示中の条件で計測データをCSV出力 |

- 画面を開いた時と、10分ごと（`POLL_INTERVAL_MS`）に自動でデータを再取得します。

### 2.3 アラート履歴（`/alerts`）

- 過去のアラート（閾値超過・傾向異常）を一覧表示（直近200件）。
- 種別（すべて／閾値超過／傾向異常）とセンサでの絞り込み、20件ごとのページネーション。
- 傾向異常アラートには「閾値到達まで」の予測時間が表示されます。
- CSVダウンロード可能。

### 2.4 管理画面（`/admin`、管理者のみ）

#### センサ管理タブ
登録済みセンサの一覧（名前・キー・有効/無効状態）と、新規センサの登録・有効化/無効化・削除を行います。詳細は[3. センサ追加方法](#3-センサ追加方法)を参照。

#### 閾値設定タブ
センサ・チャンネルごとに以下を設定します。

- 上限閾値／下限閾値
- 傾向監視のON/OFF
- 傾向監視ONの場合：判定方法（線形回帰／2次多項式回帰／振動RMS／指数平滑など）と、その判定方法固有のパラメータ

#### ユーザー管理タブ
- ユーザーの追加（ユーザー名・パスワード・ロール）
- ロール変更（自分自身は変更不可）
- パスワードリセット
- ユーザー削除（自分自身は削除不可）

#### 通知設定タブ
- SMTP設定（ホスト・ポート・ユーザー名・パスワード・送信元アドレス）をシステム共通で1つ設定
- センサごとにTeams通知・メール通知のON/OFF切替
- センサごとのTeams Webhook URL設定
- センサごとのメール通知先アドレスの追加・削除（複数登録可）

#### システム設定タブ
- データ収集間隔（分）の変更。1〜1440分の範囲。変更は次回の収集タイミングから反映されます（デフォルト10分）。

### 2.5 パスワード変更（`/change-password`）
自分のパスワードを変更します（現在のパスワードの入力が必要、4文字以上）。

---

## 3. センサ追加方法

センサ追加には2段階あります。**①は管理画面だけで完結し、②はコード変更が必要**です。

### 3.1 既に対応済みのセンサ種別を登録する（管理者操作のみ）

管理画面 → センサ管理タブ →「＋ センサ追加」

| 入力項目 | 説明 |
|---|---|
| センサキー | `SENSOR_MAP`（後述）に登録済みの種別からプルダウンで選択。すでに登録済みのキーは候補から除外される |
| センサ名 | 画面表示用の名前（例：「倉庫1 温湿度センサ」） |
| チャンネル（複数追加可） | チャンネル番号／チャンネル名／単位／傾向監視ON-OFF／上限閾値／下限閾値 |

登録すると `sensors` テーブルと `sensor_channels`・`channel_config` テーブルにレコードが作成されます。

> **注意：新規センサは必ず無効（`active = false`）で作成されます。** 登録しただけではデータ収集は始まりません。一覧の「有効化」ボタンを押すまで、cron／監視プロセスはこのセンサを無視します。
>
> Webhook URLやメール通知先は、登録後に「通知設定」タブから別途設定します。

### 3.2 新しいセンサ機種を追加する（開発者向け・コード変更が必要）

管理画面のプルダウンに出てくるのは、[`backend/devices/sensor_map.py`](../backend/devices/sensor_map.py) にハードコードされている種別だけです。まだ対応していないセンサ機種を使うには、以下の2ファイルを変更します。

**① `IMeasurementDevice` を継承したクラスを作る**

`backend/devices/` に新しいファイルを作り、`get_data()` だけを実装します（[`backend/models/device.py`](../backend/models/device.py)がインターフェース定義）。

```python
# backend/devices/new_sensor.py
from backend.interfaces import IMeasurementDevice, MeasurementData

class NewSensorDevice(IMeasurementDevice):
    def get_data(self) -> list[MeasurementData]:
        # ここで実際にセンサ／外部APIから値を取得する
        return [
            MeasurementData(channel=1, value=..., unit="℃", timestamp=...),
        ]
```

- 認証情報（APIキー等）が必要な場合は、DBではなく **`.env` の環境変数**で渡す設計です（[`backend/devices/ondotori.py`](../backend/devices/ondotori.py)を参照）。
- `timestamp`は`monitor.py`側で収集時刻に上書きされるため、暫定値で問題ありません（[8. タイムスタンプ設計方針](design.md)参照）。

**② `sensor_map.py`に1行追加する**

```python
# backend/devices/sensor_map.py
from backend.devices.new_sensor import NewSensorDevice

SENSOR_MAP = {
    'ondotori_1': OndotoriDevice,
    'dummy_humidity': DummyHumiditySensor,
    'new_sensor_1': NewSensorDevice,  # ← 追加
}
```

このキー（例：`new_sensor_1`）が、管理画面のセンサ追加フォームのプルダウンに出るようになります。あとは[3.1](#31-既に対応済みのセンサ種別を登録する管理者操作のみ)の手順でDBに登録すれば動作します。

判定ロジック・通知処理は`MeasurementData`の`channel`と`value`しか参照しないため、**これ以外のコードは一切変更不要**です（センサ抽象化による拡張性）。

---

## 4. 閾値判定ロジック追加方法

「傾向異常検知」（緩やかな変化を検知する判定）はプラグイン方式になっており、`backend/judgement/plugins/` 以下にファイルを1つ置くだけで、コードの他の場所を一切変更せずに管理画面の選択肢に追加されます。

### 4.1 既存の判定ロジック

| judgement_type | 表示名 | ファイル | 概要 |
|---|---|---|---|
| （閾値判定は常時有効・プラグイン対象外） | — | [`threshold.py`](../backend/judgement/threshold.py) | 固定の上限／下限を超えたら即異常 |
| `linear` | 線形回帰 | [`plugins/linear.py`](../backend/judgement/plugins/linear.py) | 直近データに1次回帰、傾きとR²で判定。閾値到達予測時刻も算出（デフォルト） |
| `polynomial` | 2次多項式回帰 | [`plugins/polynomial.py`](../backend/judgement/plugins/polynomial.py) | 2次回帰で瞬間傾きを算出し判定 |
| `rms` | 振動RMS | [`plugins/rms.py`](../backend/judgement/plugins/rms.py) | 直近N件のRMS（二乗平均平方根）が上下限を超えたら異常 |
| `exponential_smoothing` | 指数平滑 | [`plugins/exponential_smoothing.py`](../backend/judgement/plugins/exponential_smoothing.py) | 指数平滑値が閾値にマージン以内まで接近したら警告 |

### 4.2 プラグインの自動登録の仕組み

[`backend/judgement/factory.py`](../backend/judgement/factory.py) が起動時に `backend/judgement/plugins/` 内の `.py` ファイルをすべて自動スキャンし、以下4つの変数が定義されているモジュールを判定ロジックとして自動登録します。

| 変数名 | 内容 |
|---|---|
| `JUDGEMENT_TYPE` | 内部キー（`channel_config.judgement_type`に保存される値） |
| `JUDGEMENT_LABEL` | 管理画面プルダウンに表示される名前 |
| `JUDGEMENT_PARAMS` | 管理画面に自動生成される設定項目（キー・ラベル・型・デフォルト値・step・min/max） |
| `JUDGEMENT_CLASS` | `BaseJudgement`（[`base.py`](../backend/judgement/base.py)）を継承した判定クラス |

### 4.3 新しい判定ロジックを追加する手順

`backend/judgement/plugins/` に新しいファイルを1つ作るだけです（**他ファイルの変更は不要**）。

```python
# backend/judgement/plugins/my_judgement.py
from backend.judgement.base import BaseJudgement
from backend.interfaces import MeasurementData

JUDGEMENT_TYPE = "my_judgement"
JUDGEMENT_LABEL = "自分の判定方式"
JUDGEMENT_PARAMS = [
    {"key": "my_param", "label": "パラメータの説明", "type": "number", "default": 1.0, "step": 0.1, "min": 0},
]

class MyJudgement(BaseJudgement):
    def __init__(self, upper: float, lower: float, my_param: float = 1.0, **kwargs):
        self.upper = upper
        self.lower = lower
        self.my_param = my_param

    def judge(self, data_list: list[MeasurementData]) -> dict:
        # data_list は対象チャンネルの直近データ（古い順/新しい順は実装依存、他プラグインを参照）
        # 戻り値は base.py のdocstring通りのキーを含むdictにする
        return {
            "is_abnormal": False,
            "message": "",
            "predicted_steps": None,
            "direction": None,
            "limit_value": None,
            "predicted_at": None,
        }

JUDGEMENT_CLASS = MyJudgement
```

作成すると、次回のバックエンド起動時に自動で読み込まれ、閾値設定タブの「判定方法」プルダウンに「自分の判定方式」が現れます。`JUDGEMENT_TYPE`または`JUDGEMENT_CLASS`が未定義、あるいは`JUDGEMENT_CLASS`が`BaseJudgement`を継承していない場合はログに警告を出して黙ってスキップされるため、動作確認は必須です。

`judge()`の戻り値の`is_abnormal`が`True`の場合に、`message`の内容でTeams／メール通知が飛びます（[5.2](#52-通知の仕組み)参照）。

---

## 5. その他の重要事項

### 5.1 ロールベースアクセス制御

- ロールは`admin`（管理者）と`user`（一般ユーザー）の2種類のみです。
- 「管理」配下の全APIは`require_admin`依存（[`backend/auth/utils.py`](../backend/auth/utils.py)）で保護されており、一般ユーザーがAPIを直接叩いても`403`になります。
- 自分自身のロール変更・自分自身の削除はUI上できない作りになっています。

### 5.2 通知の仕組み

- 異常検知時、対象センサで有効化されているチャネル（Teams Webhook／メール）に通知が飛びます。
- **クールダウンあり**：同一チャンネル・同一種別（閾値超過／傾向異常）のアラートは、直前の発報から**60分以内は再通知されません**（`monitor.py`の`THRESHOLD_COOLDOWN_MINUTES`）。異常が続いていても連続で大量に通知が飛ぶことはありません。
- SMTP設定はシステム全体で1つ、Webhook URL・メール通知先はセンサごとに個別設定です。

### 5.3 データ収集の仕組み

- 本番環境ではcron（毎分）+ `flock`（多重起動防止）、Docker環境では`monitor_loop.py`が1分ごとに`monitor.main()`を呼びます。
- 実際の収集間隔は`app_settings.monitor_interval_minutes`（システム設定タブで変更可）で制御され、前回収集から間隔が経過していなければ何もせず終了します。
- **cron実行時刻を全センサ共通のタイムスタンプとして使用**します。センサAPIが返すタイムスタンプは使いません（テーブル表示の行揃えのため）。1センサがオフラインでも他センサの収集には影響しません。

### 5.4 CSV出力

- ダッシュボードの計測データ、アラート履歴それぞれに個別のCSVダウンロード機能があります。
- 文字コードはUTF-8（BOM付き、Excelでの文字化け対策）、ファイル名はRFC 5987形式でエンコードされます。

### 5.5 センサの削除について（要注意）

管理画面のセンサ削除確認ダイアログには「関連する計測データ・アラート履歴は保持されます」と表示されますが、**実際の動作はこれと異なります**。

- `sensors`テーブルの`sensor_channels`は`ON DELETE CASCADE`のため、センサ削除で**計測データ（`measurements`）も連動して削除されます**。
- `alert_history`にはCASCADE制約が無いため、アプリ側（[`backend/routers/sensors.py`](../backend/routers/sensors.py)の`delete_sensor`）が削除前に明示的に`alert_history`を削除しています。

つまり**センサを削除すると、そのセンサの計測データ・アラート履歴は全て失われます**。データを残したい場合は、削除の代わりに「無効化」を使ってください。UIの確認文言は実態と合っていないため、修正が望ましい既知の問題です。

### 5.6 環境変数一覧（`.env`）

| 変数名 | 用途 |
|---|---|
| `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASS` | PostgreSQL接続情報 |
| `SECRET_KEY` | JWT署名キー |
| `TEAMS_WEBHOOK_URL` | （現状は未使用。Webhook URLはセンサごとにDBで管理） |
| `API_KEY` / `LOGIN_ID` / `LOGIN_PASS` | おんどとり WebStorage API認証情報（`OndotoriDevice`が参照） |

新しいセンサ機種が独自の認証情報を必要とする場合も、同様に`.env`へ追記して`os.environ[...]`で読み込む設計にしてください（DBに認証情報を保存しない方針）。

### 5.7 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [design.md](design.md) | 設計決定の背景・要件・DB設計・システム構成図 |
| [setup.md](setup.md) | Docker環境のセットアップ手順 |
