/**
 * 재고 조회 어댑터 (Phase 6 이전 placeholder)
 *
 * Phase 6에서 InventoryService로 교체될 때까지,
 * 모든 자재의 현재 재고를 0g으로 반환한다.
 *
 * 교체 시 인터페이스를 그대로 유지하므로 위저드 코드는 무영향.
 */

export interface InventoryAdapter {
    /**
     * 공장(Location)별 자재 현재 재고를 g 단위로 조회
     * @param companyId   회사 ID
     * @param locationId  공장 ID
     * @param materialMasterIds  조회할 자재 ID 목록
     * @returns Map<materialMasterId, 재고량(g)>
     */
    getStockGByMaterials(
      companyId: string,
      locationId: string,
      materialMasterIds: string[],
    ): Promise<Map<string, number>>;
  }
  
  /**
   * Placeholder: 모든 자재 재고 0g
   * Phase 6 InventoryService 구현 후 이 함수를 교체
   */
  export const noopInventoryAdapter: InventoryAdapter = {
    async getStockGByMaterials(_companyId, _locationId, materialMasterIds) {
      const map = new Map<string, number>();
      for (const id of materialMasterIds) map.set(id, 0);
      return map;
    },
  };
  