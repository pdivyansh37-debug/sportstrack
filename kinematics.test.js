import { describe, it, expect } from 'vitest';
import { calculateAngle, calculateKneeFlexion, calculateTrunkLean, calculateAsymmetry } from './kinematics.js';
import { POSE_LANDMARKS } from './kinematics.js';

describe('kinematics math functions', () => {
  it('calculateAngle should compute the correct angle between 3 points', () => {
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 0 };
    const c = { x: 0, y: 1 };

    // In this 2D cartesian coordinates with y pointing down,
    // a=(1,0) (right), b=(0,0) (origin), c=(0,1) (down)
    // The angle should be 90 degrees.
    const angle = calculateAngle(a, b, c);
    expect(angle).toBeCloseTo(90, 0);
  });

  it('calculateAngle should return 180 for a straight line', () => {
    const a = { x: -1, y: 0 };
    const b = { x: 0, y: 0 };
    const c = { x: 1, y: 0 };

    const angle = calculateAngle(a, b, c);
    expect(angle).toBeCloseTo(180, 0);
  });

  it('calculateKneeFlexion should correctly evaluate flexion', () => {
    const hip = { x: 0, y: 0, z: 0 };
    const knee = { x: 0, y: 1, z: 0 };
    const ankle = { x: 0, y: 2, z: 0 };

    const flexion = calculateKneeFlexion(hip, knee, ankle);
    // Almost a straight line down
    expect(flexion).toBeCloseTo(180, -1);
  });

  it('calculateTrunkLean should compute correct lean angle relative to vertical', () => {
    const landmarks = {};
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: -1, y: 0 };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 1, y: 0 };
    landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: -1, y: 2 };
    landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 1, y: 2 };

    // Mid shoulder = (0,0), mid hip = (0,2). Vertical line, lean should be 0.
    const lean = calculateTrunkLean(landmarks);
    expect(lean).toBeCloseTo(0, 0);
  });

  it('calculateAsymmetry should correctly evaluate asymmetric distribution', () => {
    const asymmetry = calculateAsymmetry(10, 8);
    // diff = 2, max = 10 -> (2/10)*100 = 20
    expect(asymmetry).toBe(20);
  });
});
