# TurboWarp-Visual-Tracking

[日本語](README.ja.md)

Initial TurboWarp extension scaffold for visual-tracking. This repository is based on `turbowarp-extension-template` v0.4.0. The proposed runtime algorithms are not implemented yet.

## What it does

Currently provides only the template's `hello [NAME]` smoke-test block, a Vite bundle, an API manifest, tests and CI. It does not perform synchronization, tracking, or reconstruction.

## Planned implementation

See [the Japanese implementation proposal](README.ja.md) for responsibilities, dependencies, acceptance criteria and rollback. The proposal is also copied below so this entrypoint records the intended work.

### 目的

カメラ姿勢追跡の共通基盤を提供するTurboWarp拡張として開発する。

### 実装予定

- 特徴抽出providerを接続し、フレーム間・カメラ間の対応付けと特徴点追跡を行う。
- PnP / RANSAC / 三角測量 / 局所最適化によってカメラまたはrigの姿勢を推定する。
- 疎な地図、追跡品質、追跡喪失・再局在化を管理し、ARと再構成へ提供する。

### パッケージ間の関係

- camera-source: 内部校正と画像。
- time-space-sync: 撮影時刻の対応と固定rigの配置。
- 特徴抽出provider: 抽出と追跡をまとめて提供する実装も許容する。
- AR / photogrammetry: 姿勢と疎な地図の利用側。

### 設計上の条件

固定rig内の配置と移動中のrig姿勢を分ける。単眼には初期化・実寸スケールの条件が必要。画像処理はWebGPU、幾何推定・地図管理はWorkerとWASMを候補とし、GPU readbackを抑える。

### 段階導入・受け入れ基準

1. 既存実装の所在・APIと校正形式を確認し、関連GitHub Issueでスコープを確定する。
2. 互換性を保った最小経路を実装する。新経路のフィーチャーフラグは既定OFFとし、導入時に設定場所を定義する。
3. 校正済みステレオ入力で軌跡誤差・遅延・追跡喪失率を測り、追跡喪失時に無効な姿勢を正常値として出力しない。
4. 単体検証に加えて実カメラによる統合検証を記録する。

### ロールバック

抽出元の旧経路を移行中は保持し、フラグOFFで切り戻す。保存済み校正形式の互換読取りを保持する。初期雛形にはアルゴリズムもフラグもまだ存在しない。

### タスク管理

この文書はローカルの提案草案。実装着手前に本リポジトリのGitHub Issuesへ依存・DoD・チェックリスト・start/done/blockedログを記録する。Issueの作成・投稿は今回の初期配置には含まない。

## Planned architecture

```mermaid
flowchart TD
    Camera["camera-source: 画像・内部校正"] --> Sync["time-space-sync: 時刻・配置"]
    Camera --> Tracking["visual-tracking: 姿勢・疎な地図"]
    Sync --> Tracking
    Tracking --> AR["AR: セッション・アンカー"]
    Tracking --> Reconstruction["photogrammetry: 深度・形状"]
    Camera --> Reconstruction
    Sync --> Reconstruction
    Camera --> Motion["realtime-motion-capture: 身体姿勢"]
    Sync --> Motion
    AR --> Rendering["aframe: 描画"]
    Reconstruction --> Rendering
    Motion --> Rendering
```

Arrows indicate provider → consumer. This is a proposal; these integrations are not implemented in the scaffold.

## Requirements and safety

Node.js >=22.18.0 and pnpm 11.11.0. The current sample runs sandboxed. Future camera/WebGPU integration requires an explicitly implemented unsandboxed runtime and capability checks. Published packages and hosted documentation are not available as part of this scaffold.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run repo:check
```

Package identity: `@kubohiroya/turbowarp-visual-tracking@0.1.0` (local scaffold, not a published installation).
Bundle: `dist/visual-tracking.js`. Contract: `dist/extension-manifest.json`.

`pnpm run check` additionally checks generated files against Git. Run it after the initial files have been committed. No initial commit or remote publication is performed by scaffolding.

## Block reference

<!-- BEGIN GENERATED BLOCKS -->

### `hello [NAME]`

Returns a localized greeting for the supplied name.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `hello` |
| `NAME` | String, default: `world` |

<!-- END GENERATED BLOCKS -->

## License

MPL-2.0. See [LICENSE](LICENSE).
