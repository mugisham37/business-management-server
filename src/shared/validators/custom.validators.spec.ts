import { validate } from 'class-validator';
import {
  IsValidModuleName,
  IsValidModuleAction,
  IsValidHierarchyLevel,
  IsPositiveNumber,
  IsNonNegativeNumber,
  IsValidPermission,
} from './custom.validators';
import { HierarchyLevel } from '../types/hierarchy-level.enum';

class TestModuleDto {
  @IsValidModuleName()
  module!: string;
}

class TestActionDto {
  module: string = 'INVENTORY';

  @IsValidModuleAction()
  actions!: string[];
}

class TestHierarchyDto {
  @IsValidHierarchyLevel()
  level!: string;
}

class TestThresholdDto {
  @IsPositiveNumber()
  threshold!: number;
}

class TestPriorityDto {
  @IsNonNegativeNumber()
  priority!: number;
}

describe('Custom Validators', () => {
  describe('IsValidModuleName', () => {
    it('should validate valid module names', async () => {
      const dto = new TestModuleDto();
      dto.module = 'INVENTORY';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid module names', async () => {
      const dto = new TestModuleDto();
      dto.module = 'INVALID_MODULE';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isValidModuleName');
    });
  });

  describe('IsValidModuleAction', () => {
    it('should validate valid actions for a module', async () => {
      const dto = new TestActionDto();
      dto.module = 'INVENTORY';
      dto.actions = ['CREATE', 'READ', 'UPDATE'];
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid actions for a module', async () => {
      const dto = new TestActionDto();
      dto.module = 'INVENTORY';
      dto.actions = ['CREATE', 'INVALID_ACTION'];
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('IsValidHierarchyLevel', () => {
    it('should validate valid hierarchy levels', async () => {
      const dto = new TestHierarchyDto();
      dto.level = HierarchyLevel.OWNER;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid hierarchy levels', async () => {
      const dto = new TestHierarchyDto();
      dto.level = 'INVALID_LEVEL';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('IsPositiveNumber', () => {
    it('should validate positive numbers', async () => {
      const dto = new TestThresholdDto();
      dto.threshold = 100;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject zero', async () => {
      const dto = new TestThresholdDto();
      dto.threshold = 0;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject negative numbers', async () => {
      const dto = new TestThresholdDto();
      dto.threshold = -10;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('IsNonNegativeNumber', () => {
    it('should validate positive numbers', async () => {
      const dto = new TestPriorityDto();
      dto.priority = 5;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate zero', async () => {
      const dto = new TestPriorityDto();
      dto.priority = 0;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject negative numbers', async () => {
      const dto = new TestPriorityDto();
      dto.priority = -1;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
