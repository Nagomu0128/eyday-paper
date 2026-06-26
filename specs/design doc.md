# eyday-paper — Design Doc

> 個人用の「読んだ論文を投げ込むと自動で整理・蓄積し、AIで読むハードルを下げる」Webアプリ。
> デプロイ先: `eyday-paper.yoshidakazuya.com`
> 本書は反復前提の生きた文書。**価格・無料枠・モデルIDは2026年6月時点の調査値であり、実装直前に各公式ページで再確認すること。**

各設計判断には「**原則**」を併記する(なぜその選択になるかの根拠)。

---

## 1. 目的とコアドメイン

- **目的**: 論文を読むハードルを下げる。リンク/PDFを丸投げ → 自動で整理・蓄積 → AIで「探す・理解する・次に読むものを見つける」を支援。
- **コアドメイン**: 「読むハードルをどれだけ下げられるか」。機能投資はここに集中させ、周辺(凝った権限管理・SNS的機能など)は後回し。
- **想定ユーザー**: 当面は本人1人。ただしマルチユーザー化の可能性があるため、データはユーザー境界で分離して設計する。

**原則**: プロダクトには1つの軸(価値の源泉)があり、判断に迷ったらその軸に貢献するかで決める。

---

## 2. スコープ / 非スコープ

### v1 スコープ
- 取り込み: arXiv / DOI / 一般URL / PDFアップロード → メタデータ正規化・重複排除・本文抽出。
- 自動整理: AIによるタグ付け(分野/トピック/手法)＋自動ディレクトリ(フォルダ)整理。
- 閲覧: 読みやすいリフロー本文を主役・原文PDFを脇役(切替)。段落/図のタップ + テキスト選択で「ここを説明」。
- AI対話: 取り込んだ論文へのQ&A(RAG)。出力言語を日本語/英語で切替。
- 要約: 論文のTL;DR / セクション要約。出力言語を日本語/英語で切替。
- 提案(suggest): プロフィール(興味タグ/レベル/読みやすさ)に基づき、定番論文と最新研究を実APIで根拠づけして提示。ワンクリックで取り込み。
- プロフィール: 初回ログイン時 + 設定画面で 興味タグ・レベル感・読みやすさ・出力言語 を設定。
- 読書管理: 未読/読書中/読了 ステータス、簡単なメモ・ハイライト。

### 非スコープ(v1ではやらない)
- 論文原本の全文機械翻訳(コスト増。AI生成物=要約・説明・回答のみ言語切替)。
- 複数人での共有・コラボ機能(マルチユーザーの土台だけ作り、UIは出さない)。
- モバイルネイティブアプリ(レスポンシブWebで対応)。
- 引用グラフの高度な可視化(将来検討)。

**原則(YAGNI + 継ぎ目だけ用意)**: 要らない一般性は作らない。ただし将来コストが跳ねる箇所(ユーザー境界)だけは最初に継ぎ目を入れておく。

---

## 3. 確定済みの設計判断(壁打ち結果)

| 項目 | 決定 |
|---|---|
| ホスティング | Cloudflareエコシステムをフル活用 |
| 認証 | Better Auth + Google OAuth。シングルユーザー始動、データはユーザーID単位で分離 |
| 階層化 | 自動タグ(多重)＋自動ディレクトリ整理。各論文は単一の「定位置フォルダ」＋複数タグ |
| PDF表示 | リフロー本文を主役・原文PDFを脇役(切替)。タップ説明併用 |
| 言語切替 | AI生成物(要約・説明・回答)のみ ja/en 切替。原本は翻訳しない |
| 抽出・タグ付け | Gemini Flash系(最安) |
| 論文Q&A・ドラッグ説明 | OpenAI GPT系(品質重視) |
| 提案の情報源 | 実APIで根拠づけ + LLMはランキング理由づけ/要約のみ |

---

## 4. 技術スタック

### 4.1 全体像

```
┌────────────────────────────────────────────────────────────┐
│  Browser (React + Vite + pdf.js)                            │
│  - リフロー本文ビューア / 原文PDFビューア(切替)             │
│  - タップ説明・選択説明 UI / チャットUI / ダッシュボード     │
└───────────────▲───────────────────────────┬────────────────┘
                │  fetch (型共有: zod/tRPC)  │
┌───────────────┴───────────────────────────▼────────────────┐
│  Cloudflare Worker (Hono, TypeScript)  ── 無料枠で十分        │
│  - Better Auth (Google OAuth, D1ネイティブ)                  │
│  - REST/RPC ルート / RAG オーケストレーション                │
│  - Cron Trigger(日次の提案バッチ)                          │
│  - Queues 生産者(取り込み/埋め込み等の非同期ジョブ)        │
└───┬─────────┬──────────┬───────────┬───────────┬────────────┘
    │         │          │           │           │
  ┌─▼──┐  ┌──▼──┐   ┌───▼────┐  ┌───▼─────┐  ┌──▼────────────┐
  │ D1 │  │ R2  │   │Vectorize│  │Workers AI│  │ 外部API        │
  │SQL │  │PDF/ │   │ベクタ   │  │埋め込み  │  │ OpenAI/Gemini  │
  │メタ│  │本文 │   │検索     │  │(多言語) │  │ S2/arXiv/OA    │
  └────┘  └─────┘   └─────────┘  └──────────┘  └───────────────┘
                                                     │
                              (重いPDF解析が必要なとき)│
                                          ┌──────────▼──────────┐
                                          │ Container ($5/月〜)  │
                                          │ GROBID(Java)/OCR    │
                                          │ ※Goを使うならここ    │
                                          └─────────────────────┘
```

### 4.2 フロントエンド
- **React + Vite + TypeScript**。UIは Tailwind 等で軽量に。
- **pdf.js**: 原文PDF表示 + テキストレイヤ。リフロー本文は抽出済みテキスト/構造から自前レンダリング。
- 静的アセットは Worker の static assets で配信(同一オリジンでAPIと同居 → CORS不要)。

**原則**: インタラクション(選択・説明)は安定したテキストレイヤの上で行う。生PDFは2段組でテキスト選択がカラムをまたぐため、リフローを主役にする。

### 4.3 バックエンド: TypeScript on Workers(Goにしない理由)
- **Hono(TypeScript)on Cloudflare Workers**。
- Worker は V8 アイソレートで JS/TS が前提(Nodeでもgoでもない)。無料枠は1日10万リクエスト・CPU 10ms/呼び出し、I/O待ちは非課金。
- **なぜGoでないか(原則つき)**
  1. プラットフォーム整合 — Workerの実行モデルはJS/TS。GoはWASM/TinyGo経由で制約大。Containers(2026-04 GA)ならGoをフルLinuxで動かせるが$5/月の有料枠前提で、用途は重い処理であってAPI本体ではない。**原則: ネイティブな実行モデルに逆らわない。**
  2. Better Auth がTypeScript製 — 1.5でD1ファーストクラス対応。Goにすると認証を自前実装する羽目に。**原則: 中核ライブラリの言語に全体を合わせ、言語境界を増やさない。**
  3. バインディング(D1/R2/Vectorize/Workers AI/Queues/Cron)はTS前提。Goからはグルーコードが増える。
  4. 処理はI/Oバウンドのオーケストレーション。Goの並列・CPU性能の強みが効くボトルネックが無い。**原則: 最適化は実際のボトルネックに合わせる。**
  5. React + TS Workerで型をエンドツーエンド共有。一人開発で可動部最小。
- **Goの居場所**: arXiv以外のPDF構造解析(GROBID)・OCR は Container で行う(必要になったら)。GROBID自体はJavaなので、ラッパ/オーケストレータをGoで書くのは任意。

### 4.4 認証: Better Auth + Google OAuth
- Better Auth 1.5 の **D1ネイティブ対応**(`database: env.DB`)。スキーマはCLIで生成。
- ソーシャルプロバイダに Google を設定(`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`、スコープ `profile email`)。本番ドメインをリダイレクトURIに登録。
- **Googleアカウント情報をusersテーブルへ保存(保守・運用で確認用)**: Better Authの`user`テーブルは既定で `name` / `email` / `image` を保持する(=最低要件の「アカウント名」は標準で入る)。さらにGoogle OIDCプロフィール(`sub`/`given_name`/`family_name`/`locale`/`picture`)を保存したい場合は、`user.additionalFields` と Googleプロバイダの `mapProfileToUser`(プロフィール→ユーザー列のマッピング)を使う。初回サインイン時に保存し、各ログインで更新。`account` テーブルには `providerId='google'` と `accountId`(=Google `sub`)が記録される。
- **注意**: 標準のメール/パスワードはscrypt(約80ms)で無料枠の10ms CPUに当たる。Google OAuthはリダイレクト主体でローカルハッシュ不要なので無料枠でOK。将来メール認証が必要ならOTP/マジックリンク(低CPU)か$5枠へ。
- Hono ミドルウェアで auth インスタンスを**リクエストごとに1回だけ**生成(二重生成による503/`waitUntil`競合を回避)。
- マルチユーザーの継ぎ目: 全テーブルに `user_id`、全クエリで強制フィルタ。

### 4.5 ストレージ
- **R2**(PDF・抽出本文・図画像): **egress無料**で、何度も開くPDFに最適。無料枠 10GB-month / Class A 100万・Class B 1000万 ops/月。
- **D1**(関係データ): SQLite。無料枠 5GB / 読み 500万行・書き 10万行/日。1DB上限10GB、単一スレッド・**スキャン行数で課金**されるため**インデックス必須**。
- **Vectorize**(RAG用ベクタ検索): 多言語埋め込みを格納。無料の目安は 保存500万ベクタ / クエリ3,000万次元/月(要再確認)。
  - **フォールバック**: 個人規模なら埋め込みをD1に置き総当たりコサインでも十分。Vectorizeの可否で詰まらないよう、検索層は差し替え可能に保つ。

**原則**: 転送無料のストレージを選ぶ(PDFは繰り返し読まれる)。検索の土台は安価に、かつ差し替え可能に。

### 4.6 AI(モデルとルーティング)
利用キー: OpenAI / Gemini / Claude / Cloudflare経由 / gcloud経由。タスクで使い分けてコスト最適化。

| タスク | クラス | 具体モデル(2026-06) | 目安 in/out (/1M) | 原則 |
|---|---|---|---|---|
| メタデータ抽出・タグ付け・自動フォルダ判定 | Gemini Flash-Lite | `gemini-2.5-flash-lite` | $0.10 / $0.40 | 高頻度・低リスクは最安 |
| TL;DR・セクション要約 | Gemini Flash | `gemini-2.5-flash` | $0.30 / $2.50 | 構造化要約は一段上で |
| 埋め込み(多言語・密+スパース) | 多言語embed | `bge-m3`(Workers AI) ／ `text-embedding-3-small` | 低廉 | 検索の土台は安く・多言語 |
| リランク(検索精度の本丸) | クロスエンコーダ | `bge-reranker-base`(Workers AI) | 低廉 | 広く拾って厳しく絞る |
| 数式・表・スキャンの読み取り | マルチモーダル | `gemini-3-flash` / `gemini-3-pro`(ページ画像→LaTeX/MD) | Flash級 | ソースの最良形で読む |
| ドラッグ説明(短文) | GPT mini | `gpt-5.4-mini` | $0.75 / $4.50 | 対面だが範囲が狭い |
| 論文Q&A(本格) | GPT mid | `gpt-5.4` | $2.50 / $15 | ユーザー体験直結=精度 |
| 難問のエスカレーション | GPT flagship | `gpt-5.5` | $5 / $30 | 必要時のみ昇格 |
| 提案のランキング/理由づけ | 安価で粗選別→GPTで仕上げ | `gemini-2.5-flash-lite` → `gpt-5.4` | — | カスケード(段階的精緻化) |

補足:
- **多言語埋め込みは必須要件**。日本語の質問で英語論文を検索するため、`bge-m3` 等の多言語モデルを選ぶ。bge-m3は密ベクトルとスパース(キーワード)を同時に出せるため、1モデルでハイブリッド検索の土台になる。
- **検索精度の最大レバーはリランカー**。初回検索で30〜50件を広く拾い、`bge-reranker-base` で質問との関連度を採点して上位5件に絞ってからLLMへ渡す(詳細は「精度(Accuracy)戦略」)。
- 旧 `gemini-2.0-flash` は2026-06-01に終了済み。使わない。
- コスト削減レバー: **プロンプトキャッシュ**(システムプロンプト+論文文脈の再利用で大幅減)、**Batch API(各社50%引き)**を日次提案・一括再埋め込みに、RAGで文脈を必要十分に絞る。
- Geminiは Flash/Flash-Lite に無料枠あり(レート制限つき)。個人の抽出処理はこれで実質無料化も可能。ただし無料枠データはGoogleの製品改善に使われ得る点に留意(対象は主に公開論文なので実務上は許容しやすいが、判断は本人)。

**原則**: フィルタは安く、最終判断だけ丁寧に。同じ計算は繰り返さない(キャッシュ)。

### 4.6.1 LLM呼び出しの経路: Cloudflare AI Gateway に統一
原則「外部API呼び出しは単一ゲートウェイに集約し、キャッシュ・コスト可視化・上限・フォールバックを一箇所で効かせる」。

- **Workers AI(`bge-m3` / `bge-reranker-base`)はCloudflareネイティブ**。OpenAI・Geminiの呼び出しは**Cloudflare AI Gateway経由**にする(ベースURL差し替えのみ、OpenAI SDK互換)。これで**AI系トラフィックはすべてCloudflare経由**になる。
- AI Gatewayで得るもの: **応答キャッシュ**(同一プロンプトはプロバイダを叩かず即返す)、**コスト/トークン/リクエストの分析・ログ**、**レート制限**、**リトライ＆モデルのフォールバック**、**ドル建ての支出上限(spend limits)**(上限到達でブロック or 安価モデルへ)。
- コスト: ゲートウェイ自体は従量課金なし。無料枠は月10万ログ(Workers Paidで100万)。課金は2モード。
  - **(a) 自前キー + AI Gateway通過(推奨の既定)**: キャッシュ・分析・上限は無料、推論はOpenAI/Geminiへ直接支払い(手数料なし)。
  - **(b) Unified Billing**: プロバイダキーを持たずCloudflare請求に一本化。クレジット購入に+5%、推論単価は同額。
- **原則**: まず無料で効く部分(キャッシュ・上限・可観測性)を取り、課金一本化(b)は利便性が要るときに足す。

### 4.7 PDF読み取り(精度優先・段階化)
原則「ソースの最良形を使う」「下流の精度は上流の抽出品質で頭打ち」。**メタデータ・参考文献はPDFから抜かず、S2/OpenAlex/Crossrefの構造化データを使う**(より正確・安価)。本文・数式・表のみPDFから取る。

| ソース | 方法 | 精度 |
|---|---|---|
| arXiv | 公式HTML(MathML)を取得 | 最良(数式・構造ほぼ完璧、OCR不要) |
| arXiv以外・born-digital(テキスト層あり) | 本文はテキスト層を抽出。**数式・表の領域だけページ画像→マルチモーダルLLM**(`gemini-3-flash`)でLaTeX/MD化 | 高(数式・表に強い) |
| スキャンPDF(テキスト層なし) | ページ画像→マルチモーダルLLMでOCR+構造化 | 高(GPU基盤不要) |

- **なぜ自前OCR/GROBIDを既定にしないか**: MinerU/olmOCR等は高精度だがGPU前提で運用が重く、CloudflareのGPUコンテナは一般提供が限定的。個人アプリではマルチモーダルLLM(API)に読ませる方が、基盤を持たず高精度で済む。GROBIDは参考文献抽出に強いが、その情報は外部APIから取れるため不要。
- **任意の最適化(将来)**: 取り込み量が増えコストが気になったら、MinerU等を**Container($5/月〜)**に載せて自前化(Goオーケストレータを使うならここ)。あくまでコスト最適化であって精度のためではない。

**原則**: 精度は外部の最良ソース＋マルチモーダルLLMで担保。自前重量級ツールは「量が増えてコストを下げたくなったら」入れる。

---

## 5. アーキテクチャ / 主要データフロー

### 5.1 取り込み(Ingestion)
1. 入力(arXiv ID / DOI / URL / PDF)を受領。
2. **正規化**: arXiv API・OpenAlex・Crossref・Semantic Scholar でメタデータ解決。`arxiv_id`/`doi` で**重複排除**。
3. PDF/本文を R2 に保存。**本文抽出は §4.7 の段階化**(arXiv=HTML / born-digital=テキスト層+数式表はマルチモーダルLLM / スキャン=マルチモーダルLLM)。参考文献は外部APIから取得。
4. **自動タグ付け**(Gemini Flash-Lite): 分野/トピック/手法。
5. **自動フォルダ判定**: 既存フォルダ構造を文脈に与え、最適な「定位置フォルダ」を割り当て。なければ作成。フォルダが肥大化(閾値超過)したら自動でサブフォルダに再分割。
6. **チャンク分割 → 埋め込み → Vectorize**(map並列、Batch可)。
7. ステータス初期値=未読。

- **並列/ループ**: 複数投入は論文単位で並列(Queues)。長文要約はmap-reduce。**原則: 独立タスクは並列、依存タスクは逐次。**
- 自動整理は**非破壊**: 手動で動かした論文/フォルダは上書きしない。再整理は履歴を残し、やり直し可能に。**原則: 自動化はユーザーの手動操作を尊重し、可逆にする。**

### 5.2 閲覧 + 説明(コア体験)
- 主役=リフロー本文、脇役=原文PDF(ワンタップ切替)。
- **説明の起動を複数粒度で**: デスクトップ=テキスト選択→ポップオーバー。モバイル=段落/図/数式のタップ。
- LLMには「選択/対象テキスト + 前後チャンク + 論文メタ」を渡す。出力言語は設定に従う。
- **原則**: モバイルは精密選択が辛い→段落・図単位の説明も用意。文脈を添えて正確に。

### 5.3 Q&A(RAG) — 二段検索で精度を出す
1. 質問を埋め込み(bge-m3)→ **ハイブリッド検索**: 密ベクトル(Vectorize)＋キーワード(bge-m3スパース or D1のFTS5/BM25)を `user_id`(+任意で`paper_id`)で絞り、**広めに30〜50件**取得。
2. **リランク**: `bge-reranker-base` で質問と各候補を採点 → 上位5件に厳選。
3. 上位チャンク + メタ +(任意で会話履歴)を `gpt-5.4` に渡す。**取得チャンクのみから回答**させ、出典スパン(節/ページ)を併記、根拠が無ければ「無い」と言わせる。
4. クロスリンガル: 多言語埋め込みで日本語質問→英語論文を担保。必要なら質問を論文言語へ翻訳してから検索。出力言語=設定。
- **原則**: 広く拾って(recall)厳しく絞る(precision)の二段。回答は根拠に縛り、検証可能にする。LLMに渡す文脈は必要十分に。

### 5.4 提案(suggest) — 実APIで根拠づけ
- **情報源**:
  - **Semantic Scholar**: Recommendations API(ある論文に類似)＋ Academic Graph(被引用数・参考文献)。無料。**APIキー(無料・メール発行)で1RPSの専用枠**。バッチ/`fields`制限/指数バックオフ推奨。
  - **arXiv API**: 分野別の最新(Atomフィード)。
  - **OpenAlex**: 網羅・フィルタ(polite poolにメール付与)。
- **流れ**: 蔵書 + パーソナライズタグ(興味/分野・領域/企業・研究機関) + レベル/読みやすさ から候補を実APIで収集 → 安価モデルで粗選別 → `gpt-5.4` でランキングと「なぜ薦めるか」を生成(目的=goal を文脈に、避けたいトピック=avoid を抑制) → 「定番」「最新」に分けて提示。**既読・所蔵済みは除外。**
- **実行**: **Cron Trigger で日次バッチ** → 結果を D1 にキャッシュ。画面では即表示、手動更新ボタンも用意。
- **原則**: 事実(重要・最新)は実データに、解釈・個人化はLLMに。LLMの記憶だけに頼ると実在しない論文を生成する。バッチ+キャッシュで待たせない。

---

## 精度(Accuracy)戦略

論文用途は精度が要る。だが精度を上げる前に、**何が精度を決めているか**を分解する。

### 大前提
- **下流は上流で頭打ち**: 検索・回答・説明の精度は、抽出(テキスト/数式/表)の品質を超えられない。garbage in → garbage out。だから第一の投資先は抽出。
- **不安の正体を分離**:
  - 「OCR精度」と思っているものの大半は、born-digital論文の**数式・表・多段組の抽出忠実度**の問題(真のOCRはスキャンPDFだけ)。
  - 「Vectorize精度」と思っているものの本丸は、Vectorize単体(ANN近似)ではなく**検索パイプライン**。個人規模(数千〜数万チャンク)ではANNの近似誤差は無視でき、極論D1総当たりでも正確。

### 抽出の精度(§4.7と対応)
1. arXivは公式HTML(MathML)。最良。
2. arXiv以外のborn-digitalは、本文=テキスト層、数式・表=ページ画像→マルチモーダルLLM。
3. スキャンはマルチモーダルLLMでOCR+構造化。
4. メタデータ・参考文献は外部API(S2/OpenAlex/Crossref)から。PDFパースより正確。

### 検索の精度(本丸・すべてWorkers AI内)
1. **チャンク**: 節・段落の意味境界で分割し、**表・数式は割らない**。抽出品質がそのまま効く。
2. **多言語埋め込み**(bge-m3): 日本語質問→英語論文を担保。
3. **ハイブリッド検索**: 密ベクトル＋キーワード(bge-m3スパース or D1 FTS5/BM25)。手法名・記号・"Vaswani et al. 2017"等の固有表現はキーワードが強い。
4. **リランカー(最大の効き目)**: 30〜50件→`bge-reranker-base`→上位5件。「広く拾って厳しく絞る」。
5. **根拠づけ生成**: 取得チャンクのみから回答、出典スパン併記、無ければ「無い」。ドラッグ説明は選択テキスト＋前後を厳密に渡す。

### 検証可能性(限界の担保)
どの方法も抽出100%ではない。だから:
- **原本PDFを常にワンタップで開ける**(リフローが主役でも原本は脇役として常駐)。
- **回答・説明・要約に出典スパン(節/ページ)を併記**し、人が即検証できる。

**原則**: 自動化は完璧でない前提で、検証可能性を必ず残す。問題はDBではなくパイプライン。最良ソース＋二段検索＋根拠づけで精度を積み上げる。

---

## 6. データモデル(D1 スケッチ)

> Better Auth 生成テーブル(user/session/account/verification 等)に加え、アプリ固有テーブル。全テーブルに `user_id`、頻出フィルタ列にインデックス。

```sql
-- ユーザー(Better Authが生成。Googleプロフィールで拡張)
user(
  id PK,
  name,                 -- 必須: Googleアカウント名(標準で入る)
  email, email_verified,
  image,                -- 推奨: プロフィール画像URL
  google_sub,           -- 推奨: Googleの一意ID(=account.accountId)。保守時の名寄せに
  given_name, family_name, locale,  -- 任意: mapProfileToUserで保存
  created_at, updated_at
)
-- account(Better Auth): providerId='google', accountId=google sub, tokens, scope ...

-- プロフィール(1ユーザー1行)
-- interests/domains/organizations/avoid は自由記述の「サーバータグ」(Discord風)で、提案のパーソナライズ入力。
-- goal は自由記述の研究/学習目的(ランカーの文脈)。
profile(
  user_id PK,
  interests_json, domains_json, organizations_json, avoid_json, goal,
  level, readability, output_lang /* 'ja'|'en' */, updated_at
)

-- 論文
paper(
  id PK, user_id, title, authors_json, year, venue, doi, arxiv_id,
  source_url, abstract, lang_detected,
  status /* unread|reading|read */, readability_hint,
  primary_folder_id FK, pdf_r2_key, text_r2_key,
  added_at, updated_at
)
-- インデックス: (user_id, added_at), (user_id, status), unique(user_id, arxiv_id), unique(user_id, doi)

-- 自動/手動フォルダ(木構造)
folder(id PK, user_id, parent_id, name, auto_generated /* bool */, created_at)

-- タグ(多重)
tag(id PK, user_id, name, kind /* field|topic|method */)
paper_tag(paper_id, tag_id, PRIMARY KEY(paper_id, tag_id))

-- チャンク(本文はR2、検索はVectorize、ここは対応表)
chunk(id PK, paper_id, idx, section, page, vector_id, char_len)

-- メモ・ハイライト
note(id PK, paper_id, user_id, kind /* note|highlight */, range_json, body, created_at)

-- 提案キャッシュ
suggestion(
  id PK, user_id, external_id, source /* s2|arxiv|openalex */,
  title, authors_json, year, url, kind /* classic|recent */,
  score, reason, status /* suggested|imported|dismissed */, created_at
)

-- Q&A 履歴(任意)
qa_message(id PK, paper_id, user_id, role, content, created_at)
```

**R2 レイアウト**: `pdf/{userId}/{paperId}.pdf` / `text/{userId}/{paperId}.json`(構造化本文) / `fig/{userId}/{paperId}/{n}.png`

**Vectorize**: 単一インデックス。メタデータ `{ userId, paperId, chunkIdx, section }`。検索は `userId`(+必要に応じ `paperId`)でフィルタしテナント分離。

**原則**: 一緒に更新するデータは一緒に保存しI/O往復を減らす。検索のスコープは常に `user_id` で閉じる。

---

## 7. コスト戦略まとめ

- **モデル使い分け**(§4.6 の表): 抽出=Flash-Lite、Q&A=GPT-5.4、難問のみ5.5。提案はカスケード。
- **キャッシュ**: プロンプトキャッシュ(論文文脈/システムプロンプト)、**AI Gatewayの応答キャッシュ**(同一プロンプトはプロバイダを叩かない)、提案結果のD1キャッシュ、埋め込みは一度だけ生成。
- **支出上限**: AI Gatewayのspend limitsでドル建ての上限を設定し、超過時はブロック or 安価モデルへフォールバック。
- **Batch API(50%引き)**: 日次提案要約・一括再埋め込みなど非同期処理に。
- **非同期化**: 応答後の処理は `ctx.waitUntil()`(最大30秒)。それ以上は **Queues**(無料枠1万ops/日)→ 消費Worker。重い解析は **Container**。
- **並列**: 取り込み・埋め込み・要約は独立単位で並列。
- **無料枠で始める**: v1はWorkers/D1/R2/(Vectorize)/Geminiの無料枠中心。Container導入時のみ$5/月。

**原則**: 高頻度・低リスクは安く、対面・高リスクは丁寧に。重い処理は隔離し非同期化。

---

## インフラ管理(Terraform / IaC)

原則「状態を持つインフラは宣言的に(IaC)管理し、変化の速いコード・スキーマは専用ツールで。境界を明確に分ける」。

### Terraform(Cloudflareプロバイダ)で管理 — リソースグラフ
- D1データベース / R2バケット / Vectorizeインデックス / KV名前空間 / Queues / Workerリソース + bindings(`d1`/`r2_bucket`/`vectorize`/`kv_namespace`/`queue`/`ai` など)/ カスタムドメイン(`cloudflare_workers_custom_domain`)/ DNSレコード。
- **TF stateバックエンドはR2(S3互換)**(エコシステム内)。または Terraform Cloud。stateをローカルだけに置かない。
- 注意点: ①Terraformはバンドルをしない(esbuild/wranglerでバンドル後にアップロード)。②Worker versionは不変・追記型で、変更は置換になる。③Durable Obj等のマイグレーションはデプロイ時適用でTFと相性が悪い。→ **Workerコードのビルド/デプロイはwranglerに任せ、Terraformはリソースグラフを管理**する分担が安全。

### wranglerで管理 — コードと差分
- コードのビルド/デプロイ(worker version/deployment)、**D1スキーマのマイグレーション**(`wrangler d1 migrations apply`)、ローカル開発、シークレット投入。

### シークレット
- **TF stateに平文の秘密を置かない**。値は `wrangler secret put`(BETTER_AUTH_SECRET / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / OPENAI / GEMINI / S2 キー)。TFからは secret binding を参照するに留める(または Cloudflare Secrets Store + 外部シークレットバックエンド)。原則「秘密はIaCのstateに置かない」。

### Google側(唯一の手動ブートストラップ・1回限り)
- **「Sign in with Google」用のOAuthクライアント(ウェブアプリ種別)とOAuth同意画面は、Google Auth Platform のコンソールで一度だけ手動作成**。リダイレクトURI = `https://eyday-paper.yoshidakazuya.com/api/auth/callback/google`。発行された client_id/secret を wrangler secret に保存。
- **なぜTerraform化しないか**: このサインイン用クライアントを作るTerraform Googleプロバイダのリソースは存在しない。`gcloud iam oauth-clients` は Workforce Identity Federation 用(GCPリソースアクセス用で、エンドユーザーのサインインとは別物)。IAP系のAPI/Terraformリソース(`google_iap_client` 等)は2026年に廃止予定。よってサインイン用クライアントは「一度きりの手動」が現状の正解。
- Gemini APIキーもコンソール/AI Studioで発行し secret に保存。
- 原則「自動化できない一度きりのブートストラップは、手順として明文化し例外として管理する」。Better Authはこのクライアントを**消費**するだけで、登録の手間は消さない。

---

## 8. デプロイ

- **インフラ**: Cloudflareリソース=Terraform、コードのビルド/デプロイ・D1マイグレーション=wrangler(詳細は「インフラ管理(Terraform / IaC)」)。
- **ドメイン**: `eyday-paper.yoshidakazuya.com`(DNSはCloudflare、`cloudflare_workers_custom_domain` でWorkerにルート)。
- **構成**: 1つの Worker が静的アセット(React build)とAPI(Honoルート)を同一オリジンで配信。カスタムドメインをWorkerにルート。
- **シークレット**: `wrangler secret put` で BETTER_AUTH_SECRET / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / OPENAI_API_KEY / GEMINI_API_KEY / S2_API_KEY 等。
- **Google OAuth**: OAuthクライアント(ウェブアプリ種別)と同意画面はコンソールで一度だけ作成し(Terraform不可)、本番リダイレクトURIに本番ドメインを登録(詳細は「インフラ管理」)。
- **マイグレーション**: Drizzle Kit + `wrangler d1 migrations apply`(local/remote)。
- **設定フラグ**: `nodejs_compat` 有効化。
- **監視/上限**: 使用量アラートと支出上限を設定(LLM・各サービス)。指数バックオフでリトライストームを防ぐ。

---

## 9. 外部API一覧

| 用途 | API | 料金 | 備考 |
|---|---|---|---|
| 類似論文・被引用 | Semantic Scholar (Recommendations / Graph) | 無料 | 無料APIキーで1RPS専用枠。バッチ/`fields`制限/指数バックオフ |
| 最新論文(分野別) | arXiv API | 無料 | Atomフィード。礼儀正しいレート(目安1req/3s) |
| 網羅メタデータ | OpenAlex | 無料 | polite poolにメール付与 |
| DOI解決 | Crossref | 無料 | メタデータ正規化 |
| LLM(Q&A/説明/提案仕上げ) | OpenAI | 従量 | `gpt-5.4` 主、`gpt-5.5` 昇格 |
| LLM(抽出/要約) | Gemini | 従量+無料枠 | `gemini-2.5-flash-lite` / `-flash` |
| 埋め込み | Workers AI / OpenAI | 低廉 | 多言語(`bge-m3` 等) |

---

## 10. 未決事項 / 次のステップ

**未決(要確認)**
1. **PDF読み取り**: arXiv=HTML / born-digital=テキスト層+数式表はマルチモーダルLLM / スキャン=マルチモーダルLLM、で良いか(推奨)。自前OCR/GROBIDコンテナは量が増えてコスト最適化したくなったら後付け。
2. **埋め込み+リランク**: Workers AI `bge-m3`(密+スパース)＋`bge-reranker-base` の二段を既定にして良いか。
3. **提案ソースの優先度**: S2(類似/被引用)主 + arXiv(最新)+ OpenAlex(網羅)で良いか。
4. **メモ/ハイライト**を v1 に含める前提で良いか(現状: 含める)。
5. **Vectorize無料枠の現行条件**の最終確認(不可ならD1総当たりにフォールバック)。

**次のステップ**
- 本Docの未決事項を確定 → Agent用プロンプト(実装指示)に落とす。
- リポジトリ雛形(Hono + Better Auth + Drizzle/D1 + R2 + Vectorize + Vite/React + **Terraform**)を定義。
- **Terraform構成**: `infra/` にCloudflareプロバイダ設定・リソース定義(D1/R2/Vectorize/KV/Queues/Worker+bindings/カスタムドメイン)・R2(S3互換)stateバックエンド・出力(リソースID/名)を置き、wrangler.jsoncはその出力を参照。
- データモデルとAPIルートのインターフェイス(zod/型)を確定。
- Terraformモジュール(Cloudflareリソース一式)と、Google OAuthクライアント発行の手動ブートストラップ手順書を用意。

---

## 付録: 主要な「原則」一覧
- プロダクトの軸(読むハードルを下げる)に貢献するかで判断する。
- 要らない一般性は作らない(YAGNI)。ただし将来高コスト化する継ぎ目(ユーザー境界)だけ先に用意。
- プラットフォームのネイティブ実行モデルに逆らわない。
- 中核ライブラリの言語に全体を合わせ、言語境界を増やさない。
- 最適化は実際のボトルネックに合わせる(ここはI/Oバウンド)。
- 転送無料のストレージを選ぶ。検索層は差し替え可能に保つ。
- 高頻度・低リスクは安く、対面・高リスクは丁寧に(モデルのカスケード)。
- 事実は実データに、解釈・個人化はLLMに(ハルシネーション回避)。
- 同じ計算は繰り返さない(キャッシュ)。重い処理は隔離し非同期化。
- 自動化はユーザーの手動操作を尊重し、可逆(非破壊)にする。
- インタラクションは安定したテキストレイヤの上で行う。
- 下流(検索・回答)の精度は上流(抽出)の品質で頭打ちになる。
- ソースの最良形を使う(arXiv HTML > テキスト層+VLM > VLMによるOCR)。構造化された外部データはPDFパースより正確。
- 検索は「広く拾って(recall)厳しく絞る(precision)」二段。リランカーが最大の効き目。専門用語はキーワードで補完。
- 自動化は完璧でない前提で、検証可能性を必ず残す(原本ワンタップ＋出典スパン併記)。
- 状態を持つインフラは宣言的に(Terraform/IaC)管理し、変化の速いコード・スキーマは専用ツール(Wrangler)に任せ、境界を分ける。秘密はIaCのstateに置かない。
- 保守・名寄せの鍵は変わりうるメールではなく安定ID(Google `sub`)を使う。
- 外部API(LLM)呼び出しは単一ゲートウェイ(AI Gateway)に集約し、キャッシュ・コスト可視化・上限・フォールバックを一箇所で効かせる。
- 状態を持つインフラは宣言的に(IaC)、変化の速いコード・スキーマは専用ツールで。境界を明確に。
- 秘密情報はIaCのstateに置かない。
- 認証ライブラリはIdPのクライアント資格情報を“消費”するが“発行”はしない。自動化できない一度きりのブートストラップは手順を明文化し例外管理する。