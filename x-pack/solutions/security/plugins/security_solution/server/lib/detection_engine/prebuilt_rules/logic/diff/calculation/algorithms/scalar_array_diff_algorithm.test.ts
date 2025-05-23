/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ThreeVersionsOf } from '../../../../../../../../common/api/detection_engine';
import {
  ThreeWayDiffOutcome,
  ThreeWayMergeOutcome,
  MissingVersion,
  ThreeWayDiffConflict,
} from '../../../../../../../../common/api/detection_engine';
import {
  ScalarArrayDiffMissingBaseVersionStrategy,
  createScalarArrayDiffAlgorithm,
} from './scalar_array_diff_algorithm';

describe('scalarArrayDiffAlgorithm', () => {
  describe.each([
    [ScalarArrayDiffMissingBaseVersionStrategy.Merge],
    [ScalarArrayDiffMissingBaseVersionStrategy.UseTarget],
  ])('with missingBaseCanUpdateMergeStrategy = %s', (mergeStrategy) => {
    const scalarArrayDiffAlgorithm = createScalarArrayDiffAlgorithm({
      missingBaseVersionStrategy: mergeStrategy,
    });

    describe('base cases', () => {
      it('returns current_version as merged output if there is no update - scenario AAA', () => {
        const mockVersions: ThreeVersionsOf<string[]> = {
          base_version: ['one', 'two', 'three'],
          current_version: ['one', 'two', 'three'],
          target_version: ['one', 'two', 'three'],
        };

        const result = scalarArrayDiffAlgorithm(mockVersions, false);

        expect(result).toEqual(
          expect.objectContaining({
            merged_version: mockVersions.current_version,
            diff_outcome: ThreeWayDiffOutcome.StockValueNoUpdate,
            merge_outcome: ThreeWayMergeOutcome.Current,
            conflict: ThreeWayDiffConflict.NONE,
          })
        );
      });

      it('returns current_version as merged output if current_version is different and there is no update - scenario ABA', () => {
        const mockVersions: ThreeVersionsOf<string[]> = {
          base_version: ['one', 'two', 'three'],
          current_version: ['one', 'three', 'four'],
          target_version: ['one', 'two', 'three'],
        };

        const result = scalarArrayDiffAlgorithm(mockVersions, false);

        expect(result).toEqual(
          expect.objectContaining({
            merged_version: mockVersions.current_version,
            diff_outcome: ThreeWayDiffOutcome.CustomizedValueNoUpdate,
            merge_outcome: ThreeWayMergeOutcome.Current,
            conflict: ThreeWayDiffConflict.NONE,
          })
        );
      });

      it('returns target_version as merged output if current_version is the same and there is an update - scenario AAB', () => {
        const mockVersions: ThreeVersionsOf<string[]> = {
          base_version: ['one', 'two', 'three'],
          current_version: ['one', 'two', 'three'],
          target_version: ['one', 'four', 'three'],
        };

        const result = scalarArrayDiffAlgorithm(mockVersions, false);

        expect(result).toEqual(
          expect.objectContaining({
            merged_version: mockVersions.target_version,
            diff_outcome: ThreeWayDiffOutcome.StockValueCanUpdate,
            merge_outcome: ThreeWayMergeOutcome.Target,
            conflict: ThreeWayDiffConflict.NONE,
          })
        );
      });

      it('returns current_version as merged output if current version is different but it matches the update - scenario ABB', () => {
        const mockVersions: ThreeVersionsOf<string[]> = {
          base_version: ['one', 'two', 'three'],
          current_version: ['one', 'three', 'four'],
          target_version: ['one', 'four', 'three'],
        };

        const result = scalarArrayDiffAlgorithm(mockVersions, false);

        expect(result).toEqual(
          expect.objectContaining({
            merged_version: mockVersions.current_version,
            diff_outcome: ThreeWayDiffOutcome.CustomizedValueSameUpdate,
            merge_outcome: ThreeWayMergeOutcome.Current,
            conflict: ThreeWayDiffConflict.NONE,
          })
        );
      });

      it('returns custom merged version as merged output if all three versions are different - scenario ABC', () => {
        const mockVersions: ThreeVersionsOf<string[]> = {
          base_version: ['one', 'two', 'three'],
          current_version: ['two', 'three', 'four', 'five'],
          target_version: ['one', 'three', 'four', 'six'],
        };
        const expectedMergedVersion = ['three', 'four', 'five', 'six'];

        const result = scalarArrayDiffAlgorithm(mockVersions, false);

        expect(result).toEqual(
          expect.objectContaining({
            merged_version: expectedMergedVersion,
            diff_outcome: ThreeWayDiffOutcome.CustomizedValueCanUpdate,
            merge_outcome: ThreeWayMergeOutcome.Merged,
            conflict: ThreeWayDiffConflict.SOLVABLE,
          })
        );
      });
    });

    describe('edge cases', () => {
      it('compares arrays agnostic of order', () => {
        const mockVersions: ThreeVersionsOf<string[]> = {
          base_version: ['one', 'two', 'three'],
          current_version: ['one', 'three', 'two'],
          target_version: ['three', 'one', 'two'],
        };

        const result = scalarArrayDiffAlgorithm(mockVersions, false);

        expect(result).toEqual(
          expect.objectContaining({
            merged_version: mockVersions.current_version,
            diff_outcome: ThreeWayDiffOutcome.StockValueNoUpdate,
            merge_outcome: ThreeWayMergeOutcome.Current,
            conflict: ThreeWayDiffConflict.NONE,
          })
        );
      });

      describe('compares arrays deduplicated', () => {
        it('when values duplicated in base version', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: ['one', 'two', 'two'],
            current_version: ['one', 'two'],
            target_version: ['one', 'two'],
          };
          const expectedMergedVersion = ['one', 'two'];

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              merged_version: expectedMergedVersion,
              diff_outcome: ThreeWayDiffOutcome.StockValueNoUpdate,
              merge_outcome: ThreeWayMergeOutcome.Current,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });

        it('when values are duplicated in current version', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: ['one', 'two'],
            current_version: ['one', 'two', 'two'],
            target_version: ['one', 'two'],
          };
          const expectedMergedVersion = ['one', 'two'];

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              merged_version: expectedMergedVersion,
              diff_outcome: ThreeWayDiffOutcome.StockValueNoUpdate,
              merge_outcome: ThreeWayMergeOutcome.Current,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });

        it('when values are duplicated in target version', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: ['one', 'two'],
            current_version: ['one', 'two'],
            target_version: ['one', 'two', 'two'],
          };
          const expectedMergedVersion = ['one', 'two'];

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              merged_version: expectedMergedVersion,
              diff_outcome: ThreeWayDiffOutcome.StockValueNoUpdate,
              merge_outcome: ThreeWayMergeOutcome.Current,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });

        it('when values are duplicated in all versions', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: ['one', 'two', 'two'],
            current_version: ['two', 'two', 'three'],
            target_version: ['one', 'one', 'three', 'three'],
          };
          const expectedMergedVersion = ['three'];

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              merged_version: expectedMergedVersion,
              diff_outcome: ThreeWayDiffOutcome.CustomizedValueCanUpdate,
              merge_outcome: ThreeWayMergeOutcome.Merged,
              conflict: ThreeWayDiffConflict.SOLVABLE,
            })
          );
        });
      });

      describe('compares empty arrays', () => {
        it('when base version is empty', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: [],
            current_version: ['one', 'two'],
            target_version: ['one', 'two'],
          };

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              merged_version: mockVersions.current_version,
              diff_outcome: ThreeWayDiffOutcome.CustomizedValueSameUpdate,
              merge_outcome: ThreeWayMergeOutcome.Current,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });

        it('when current version is empty', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: ['one', 'two'],
            current_version: [],
            target_version: ['one', 'two'],
          };

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              merged_version: mockVersions.current_version,
              diff_outcome: ThreeWayDiffOutcome.CustomizedValueNoUpdate,
              merge_outcome: ThreeWayMergeOutcome.Current,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });

        it('when target version is empty', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: ['one', 'two'],
            current_version: ['one', 'two'],
            target_version: [],
          };

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              merged_version: mockVersions.target_version,
              diff_outcome: ThreeWayDiffOutcome.StockValueCanUpdate,
              merge_outcome: ThreeWayMergeOutcome.Target,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });

        it('when all versions are empty', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: [],
            current_version: [],
            target_version: [],
          };

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              merged_version: [],
              diff_outcome: ThreeWayDiffOutcome.StockValueNoUpdate,
              merge_outcome: ThreeWayMergeOutcome.Current,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });
      });
    });

    describe('and base_version is missing', () => {
      describe('returns target_version as merged output if current_version and target_version are the same - scenario -AA', () => {
        it('returns NONE conflict if rule is not customized', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: MissingVersion,
            current_version: ['one', 'two', 'three'],
            target_version: ['one', 'two', 'three'],
          };

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              has_base_version: false,
              base_version: undefined,
              merged_version: mockVersions.target_version,
              diff_outcome: ThreeWayDiffOutcome.MissingBaseNoUpdate,
              merge_outcome: ThreeWayMergeOutcome.Target,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });

        it('returns NONE conflict if rule is customized', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: MissingVersion,
            current_version: ['one', 'two', 'three'],
            target_version: ['one', 'two', 'three'],
          };

          const result = scalarArrayDiffAlgorithm(mockVersions, true);

          expect(result).toEqual(
            expect.objectContaining({
              has_base_version: false,
              base_version: undefined,
              merged_version: mockVersions.target_version,
              diff_outcome: ThreeWayDiffOutcome.MissingBaseNoUpdate,
              merge_outcome: ThreeWayMergeOutcome.Target,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });
      });

      describe('if current_version and target_version are different - scenario -AB', () => {
        it('returns target_version as merged output and NONE conflict if rule is not customized', () => {
          const mockVersions: ThreeVersionsOf<string[]> = {
            base_version: MissingVersion,
            current_version: ['one', 'two', 'three'],
            target_version: ['one', 'four', 'three'],
          };

          const result = scalarArrayDiffAlgorithm(mockVersions, false);

          expect(result).toEqual(
            expect.objectContaining({
              has_base_version: false,
              base_version: undefined,
              merged_version: mockVersions.target_version,
              diff_outcome: ThreeWayDiffOutcome.MissingBaseCanUpdate,
              merge_outcome: ThreeWayMergeOutcome.Target,
              conflict: ThreeWayDiffConflict.NONE,
            })
          );
        });
      });
    });
  });

  describe('when base_version is missing', () => {
    it('returns merged version of current and target as merged output if rule is customized', () => {
      const mockVersions: ThreeVersionsOf<string[]> = {
        base_version: MissingVersion,
        current_version: ['one', 'two', 'three'],
        target_version: ['one', 'four', 'three'],
      };

      const expectedMergedVersion = ['one', 'two', 'three', 'four'];

      const scalarArrayDiffAlgorithm = createScalarArrayDiffAlgorithm({
        missingBaseVersionStrategy: ScalarArrayDiffMissingBaseVersionStrategy.Merge,
      });
      const result = scalarArrayDiffAlgorithm(mockVersions, true);

      expect(result).toEqual(
        expect.objectContaining({
          has_base_version: false,
          base_version: undefined,
          merged_version: expectedMergedVersion,
          diff_outcome: ThreeWayDiffOutcome.MissingBaseCanUpdate,
          merge_outcome: ThreeWayMergeOutcome.Merged,
          conflict: ThreeWayDiffConflict.SOLVABLE,
        })
      );
    });

    it('returns target version of current and target as merged output if rule is customized', () => {
      const targetVersion = ['one', 'four', 'three'];

      const mockVersions: ThreeVersionsOf<string[]> = {
        base_version: MissingVersion,
        current_version: ['one', 'two', 'three'],
        target_version: targetVersion,
      };

      const scalarArrayDiffAlgorithm = createScalarArrayDiffAlgorithm({
        missingBaseVersionStrategy: ScalarArrayDiffMissingBaseVersionStrategy.UseTarget,
      });
      const result = scalarArrayDiffAlgorithm(mockVersions, true);

      expect(result).toEqual(
        expect.objectContaining({
          has_base_version: false,
          base_version: undefined,
          merged_version: targetVersion,
          diff_outcome: ThreeWayDiffOutcome.MissingBaseCanUpdate,
          merge_outcome: ThreeWayMergeOutcome.Target,
          conflict: ThreeWayDiffConflict.SOLVABLE,
        })
      );
    });
  });
});
