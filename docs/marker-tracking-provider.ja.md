# マーカートラッキング provider

[English](marker-tracking-provider.md)

このパッケージが最初に出すトラッキング provider の設計です。リポジトリの提案が描く system そのものではなく、**いま作って検証できる部分**であり、ここで公開する境界は後続の system がそのまま使うものです。

## 何であり、何でないか

校正済みカメラから、**既知サイズの平面 fiducial マーカー**の 6-DoF 姿勢を推定し、それを AR target として公開します。

SLAM ではありません。特徴地図も、再局在化も、スケール推定も、カメラ軌跡の概念もありません。各フレームは、そのフレームに完全に写っているマーカーから単独で解きます。マーカーが見えないときは、その旨を報告して何も公開しません。**古い姿勢を現在のものとして持ち越すことは決してしません。**

この制限が検証可能性を生みます。マーカーの四隅はマーカー平面上の既知座標なので、1フレームは閉形式の対応問題であり、既知姿勢のマーカーを描画した画像は**期待値が厳密に決まるテスト**になります。

## 既にあるもの

リポジトリの提案が示すより作業は遥かに小さくなります。`turbowarp-camera-calibration` が難しい基盤を既に解決しているためです。

| 要素 | 現在の所在 |
|---|---|
| worker 向けにビルドした OpenCV.js | `vendor/opencv.js`（`tools/opencv/build.sh` が `ENVIRONMENT=web,worker` でビルド） |
| comlink インターフェースを持つ worker | `src/calibration/opencv-worker.ts` |
| ビルド内容の検証 | `src/calibration/opencv-symbols.ts` がシンボル不足時に fail closed |
| ArUco 検出 | `getPredefinedDictionary`、`DICT_4X4_50`、`aruco_DetectorParameters`、`aruco_RefineParameters` — 既に許可リスト内 |
| `solvePnP` | 既に許可リスト内 |
| カメラ内部パラメータ | カメラごとに `{fx, fy, cx, cy, skew}` と歪みを公開済み |

つまりこの provider は「OpenCV を統合して姿勢推定を書く」作業ではありません。**その worker 方式を再利用し、ChArUco ボード校正をフレームごとのマーカー検出に差し替え、解いて、公開する**だけです。標準の OpenCV ビルドは worker で初期化が終わらないためにカスタムビルドが存在します。これを再発見せず再利用してください。

## 構成

```
camera-source ──フレーム──▶ visual-tracking worker ──姿勢──▶ turbowarp-ar targets ──▶ turbowarp-aframe
      │                          ▲
      └─── camera-calibration ───┘
              内部パラメータ
```

provider は他の拡張と同じ共有カメラを lease し、そのカメラの校正プロファイルを読み、検出と `solvePnP` をステージのスレッド外で実行します。720p で検出に約20ミリ秒かかるため、ステージが描画するスレッドでは動かせません。

描画は行いません。姿勢は `turbowarp-ar` の既存の target 状態と selector attachment を通じてシーンへ届きます。そちらは既に A-Frame capability 経由で node を書いています。

## provider の境界

`turbowarp-ar` のランタイム capability は意図的に姿勢の手前で止めてあります。scene の構築とライフサイクルだけを公開しているのは、この設計が無い状態で姿勢を port の背後に入れると、境界が偶然で決まってしまうからです。ここで決めます。

**provider が push し、AR は pull しません。** トラッキング provider はカメラのレートで姿勢を生み、polling する consumer は更新を取りこぼすか worker を止めるかのどちらかになります。したがって `turbowarp-ar` に姿勢側の capability を追加し、provider がそれを呼びます。

```ts
interface ARTargetPosePort {
  /** provider 自身の品質尺度による、1 target の可視性と確信度。 */
  setARTargetVisible(targetId: string, visible: boolean, confidence: number): void;
  setARTargetPosition(targetId: string, x: number, y: number, z: number): void;
  setARTargetRotation(targetId: string, x: number, y: number, z: number): void;
}
```

これらはブロックが既に行っている操作なので、port が挙動を増やすことはありません。**手動 backend を差し替え可能にするだけ**です。provider を読み込まなくてもブロックは残るため、作品は従来どおり動きます。

target の命名が両者の契約です。ArUco id `7` のマーカーは既定で target id `marker-7` へ公開し、シーンは従来どおり `selector: "#card"` をその target id へ bind します。

## 座標系

OpenCV と A-Frame は一致しません。ここを誤ると「ほぼ正しく見えるが間違っている」シーンになります。

- OpenCV のカメラ空間は **x 右・y 下・z 前方**で、`solvePnP` は回転ベクトル（Rodrigues）とマーカー単位の並進を返します。
- A-Frame は **x 右・y 上・z 視点方向**で、回転は度の Euler 角です。

変換は y 軸と z 軸の反転と、回転ベクトルから Euler 度への変換です。これは worker のあちこちに散らさず、**専用のテストを持つ1つの関数**に置いてください。符号の取り違えが静かに起きる最有力の場所です。

マーカーサイズはメートルで与え、姿勢もメートルで公開します。A-Frame の単位に合わせます。

## 追跡喪失

古い姿勢を現在のものとして公開する provider は、provider が無いより悪いです。シーンは生きて見えるのに間違っているからです。規則は次のとおりです。

- そのフレームで検出されなかった target は、**不可視として公開**します。最後の姿勢は consumer が「どこにあったか」を読めるよう保持しますが、`setARTargetVisible` は false を返します。
- 確信度は検出の有無ではなく、**ソルバの再投影誤差**から算出します。ほぼ真横から見たマーカーは解が悪く、それを報告しなければなりません。
- 再投影誤差が閾値を超えた姿勢は、検出なしとして扱います。
- 平滑化は任意で既定 OFF、かつ**外挿しません**。喪失した target をもっともらしい姿勢へ平滑化してしまうことが、この節が防ごうとしている失敗です。

## 検証

決定的なものを先に、実機を後に。

1. **合成画像。** 既知の内部パラメータで既知姿勢のマーカーを描画し、パイプラインに通して厳密な期待姿勢と比較します。並進と回転の誤差閾値を目視ではなくアサートします。CI で動き、カメラは不要です。
2. **退化入力。** マーカー無し、部分遮蔽、斜入射、同一 id の重複、モーションブラー。それぞれ期待挙動を定義し、**いずれも確信度の高い姿勢を公開してはなりません**。
3. **実カメラ。** 印刷したマーカーを実測距離に置き、誤差と遅延を測って統合検証ノートとして記録します。自動化せず、リリースごとに記録します。

座標変換は手計算のケースで**単独にテスト**します。描画と求解が同じ規約を通る合成テストは、自己無矛盾なまま間違いうるためです。

## 段階導入

1. 校正の worker 方式を再利用（vendored OpenCV、comlink、マーカー検出に必要なシンボルを許可リストへ追加）。挙動はまだ無し。
2. 単一マーカーの検出と `solvePnP`、新設した AR 姿勢 port 経由での公開。既定 OFF のフラグ配下。
3. 複数マーカー、再投影誤差による確信度、喪失規則。
4. 任意の平滑化。依然として既定 OFF。

ロールバックはフラグです。OFF のとき `turbowarp-ar` は現在とまったく同じに振る舞い、姿勢はブロックが設定します。**手動ブロックはどの段階でも削除しません。** カメラ無しでシーンを試す手段として残します。

## ここで決めていないこと

リポジトリの提案が描く大きい system — 特徴追跡、疎な地図、再局在化、rig 姿勢 — には触れていません。この provider は意図的に葉です。後続の system も同じ port から姿勢を公開できます。ここに書かれたことは、その system が同じ port を使うという一点を除き、その設計を確定させるものではありません。
