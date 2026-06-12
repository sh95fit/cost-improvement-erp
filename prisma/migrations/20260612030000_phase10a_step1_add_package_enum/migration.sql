-- Phase 10-A Step 1: unit_category enum에 PACKAGE 추가
ALTER TYPE "unit_category" ADD VALUE IF NOT EXISTS 'PACKAGE';