# Marker tracking provider

[日本語](marker-tracking-provider.ja.md)

A design for the first tracking provider this package ships. It is not the system the repository
proposal describes; it is the part of it that can be built and verified now, and the boundary it
publishes is the one a later system keeps.

## What it is, and what it is not

It estimates the 6-DoF pose of **planar fiducial markers** of known size from a calibrated camera,
and publishes those poses as AR targets.

It is not SLAM. There is no feature map, no relocalization, no scale estimation, and no notion of
camera trajectory. Each frame is solved on its own from markers that are fully visible in it. When
no marker is visible, the provider reports that and publishes nothing — it never carries a stale
pose forward as if it were current.

That restriction is what makes it verifiable. A marker's four corners have known coordinates in the
marker's own plane, so a single frame is a closed-form correspondence problem, and a rendered image
of a marker at a known pose is a test with an exact expected answer.

## What already exists

The work is much smaller than the repository proposal implies, because `turbowarp-camera-calibration`
has already solved the hard infrastructure:

| Piece | Where it is today |
|---|---|
| OpenCV.js, built for workers | `vendor/opencv.js`, built by `tools/opencv/build.sh` with `ENVIRONMENT=web,worker` |
| Worker with a comlink interface | `src/calibration/opencv-worker.ts` |
| Build verification | `src/calibration/opencv-symbols.ts` fails closed when the pinned build lacks a symbol |
| ArUco detection | `getPredefinedDictionary`, `DICT_4X4_50`, `aruco_DetectorParameters`, `aruco_RefineParameters` — already in the allowlist |
| `solvePnP` | already in the allowlist |
| Camera intrinsics | published per camera as `{fx, fy, cx, cy, skew}` with distortion |

So this provider is not "integrate OpenCV and write pose estimation". It is: reuse that worker
pattern, swap ChArUco-board calibration for per-frame marker detection, solve, and publish. The
stock OpenCV build does not initialize in a worker, which is why the custom build exists; reuse it
rather than rediscovering that.

## Shape

```
camera-source ──frames──▶ visual-tracking worker ──pose──▶ turbowarp-ar targets ──▶ turbowarp-aframe
      │                        ▲
      └── camera-calibration ──┘
              intrinsics
```

The provider leases the same shared camera every other extension uses, reads the calibration profile
for that camera, and runs detection and `solvePnP` off the stage thread. Detection costs roughly
twenty milliseconds at 720p, which is why it cannot run where the stage draws.

Nothing renders. Pose reaches the scene through `turbowarp-ar`'s existing target state and its
selector attachment, which already writes A-Frame nodes through the A-Frame capability.

## The provider boundary

`turbowarp-ar`'s runtime capability deliberately stops before pose: it exposes scene construction and
lifecycle only, because putting pose behind that port before this design existed would have fixed the
boundary by accident. This design decides it.

The provider pushes; AR does not pull. A tracking provider produces poses at the camera's rate, and a
consumer that polled would either miss updates or block the worker. So `turbowarp-ar` gains the pose
half of its capability, and the provider calls it:

```ts
interface ARTargetPosePort {
  /** Visibility and confidence for one target, from the provider's own quality measure. */
  setARTargetVisible(targetId: string, visible: boolean, confidence: number): void;
  setARTargetPosition(targetId: string, x: number, y: number, z: number): void;
  setARTargetRotation(targetId: string, x: number, y: number, z: number): void;
}
```

These are the operations the blocks already perform, so the port adds no behavior — it only makes the
manual backend replaceable. A project keeps working with no provider loaded, because the blocks stay.

Target naming is the contract between the two: a marker with ArUco id `7` publishes to target id
`marker-7` by default, and a scene binds `selector: "#card"` to that target id as it does today.

## Coordinates

OpenCV and A-Frame do not agree, and getting this wrong produces a scene that looks almost right.

- OpenCV camera space is **x right, y down, z forward**, and `solvePnP` returns a rotation vector
  (Rodrigues) plus a translation in the marker's units.
- A-Frame is **x right, y up, z toward the viewer**, with rotation as Euler degrees.

The conversion is a flip of the y and z axes and a rotation-vector to Euler-degrees conversion. It
belongs in one function with its own tests, not spread through the worker, because it is the single
most likely place for a silent sign error.

Marker size is given in metres and poses are published in metres, matching A-Frame's unit.

## Tracking loss

A provider that publishes a stale pose as a current one is worse than no provider: the scene looks
alive while it is wrong. The rules:

- A target not detected in a frame is published as not visible. Its last pose is retained so a
  consumer can read where it was, but `setARTargetVisible` says false.
- Confidence comes from the solver's reprojection error, not from whether a detection occurred.
  A marker seen nearly edge-on solves poorly and must report that.
- A pose whose reprojection error exceeds a threshold is treated as no detection.
- Optional smoothing is off by default, and never extrapolates. Smoothing a lost target into a
  plausible-looking pose is the failure this section exists to prevent.

## Verification

Deterministic first, then real:

1. **Synthetic.** Render a marker at a known pose with known intrinsics, run the pipeline, compare
   against the exact expected pose. Translation and rotation error thresholds are asserted, not
   eyeballed. This runs in CI and needs no camera.
2. **Degenerate inputs.** No marker, partially occluded marker, marker at grazing angle, two markers
   with the same id, motion blur. Each has a defined expected behavior, and none may publish a
   confident pose.
3. **Real camera.** A printed marker at measured distances, recorded as an integration note with
   measured error and latency. Not automated; recorded per release.

The coordinate conversion is tested on its own with hand-computed cases, because a synthetic test
that renders and solves through the same convention can be self-consistently wrong.

## Staged delivery

1. Reuse the calibration worker pattern: vendored OpenCV, comlink, symbol allowlist extended with
   what marker detection needs. No behavior yet.
2. Detection and `solvePnP` for one marker, published through the new AR pose port, behind a flag
   that is off by default.
3. Multiple markers, confidence from reprojection error, loss policy.
4. Optional smoothing, still off by default.

Rollback is the flag: with it off, `turbowarp-ar` behaves exactly as it does today, with pose set by
blocks. The manual blocks are not removed at any stage — they remain the way a project tests a scene
without a camera.

## What this does not decide

The repository proposal's larger system — feature tracking, sparse map, relocalization, rig poses —
is untouched. This provider is deliberately a leaf: it publishes poses through a port that a later
system can publish through as well. Nothing here should be read as settling how that system works,
except that it will use the same port.
