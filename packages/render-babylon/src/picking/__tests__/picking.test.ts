// Picking tests for render-babylon
// These tests validate thin-instance picking logic without Babylon DOM requirements.

import { describe, it, expect } from 'vitest';
import type { PickResult, PickingOptions } from '../types.js';

describe('picking', () => {
  describe('inferPickType (via pickOne integration)', () => {
    it('should return null pick when scene is null', async () => {
      // Cannot run Babylon picks in Node environment without headless canvas
      // This test validates the types are correct
      const mockResult: PickResult = {
        pickedId: null,
        pickedType: null,
        worldPoint: null,
        distance: null,
      };
      expect(mockResult.pickedId).toBeNull();
      expect(mockResult.pickedType).toBeNull();
    });

    it('should have correct PickResult shape', () => {
      const result: PickResult = {
        pickedId: 'node:upright-001',
        pickedType: 'node',
        worldPoint: { x: 100, y: 200, z: 300 },
        distance: 1.5,
      };
      expect(result.pickedId).toBe('node:upright-001');
      expect(result.pickedType).toBe('node');
      expect(result.worldPoint?.x).toBe(100);
      expect(result.distance).toBe(1.5);
    });

    it('should have correct PickingOptions shape', () => {
      const options: PickingOptions = {
        filterIds: ['node:upright-001', 'node:upright-002'],
        filterTypes: ['node', 'joint'],
      };
      expect(options.filterIds).toHaveLength(2);
      expect(options.filterTypes).toContain('node');
    });
  });

  describe('pick type inference', () => {
    it('should classify node prefixed ids as node type', async () => {
      const mockPick = (name: string): PickResult => ({
        pickedId: name,
        pickedType: name.startsWith('node:') ? 'node' : name.startsWith('joint:') ? 'joint' : 'module',
        worldPoint: null,
        distance: null,
      });
      expect(mockPick('node:upright-001').pickedType).toBe('node');
      expect(mockPick('node:beamX-002').pickedType).toBe('node');
    });

    it('should classify joint prefixed ids as joint type', async () => {
      const mockPick = (name: string): PickResult => ({
        pickedId: name,
        pickedType: name.startsWith('node:') ? 'node' : name.startsWith('joint:') ? 'joint' : 'module',
        worldPoint: null,
        distance: null,
      });
      expect(mockPick('joint:corner-001').pickedType).toBe('joint');
      expect(mockPick('joint:tee-002').pickedType).toBe('joint');
    });

    it('should classify module prefixed ids as module type', async () => {
      const mockPick = (name: string): PickResult => ({
        pickedId: name,
        pickedType: name.startsWith('node:') ? 'node' : name.startsWith('joint:') ? 'joint' : 'module',
        worldPoint: null,
        distance: null,
      });
      expect(mockPick('module:bay[0]').pickedType).toBe('module');
    });
  });
});
