"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RecipeList } from "@/features/recipe/components/recipe-list";
import { RecipeForm } from "@/features/recipe/components/recipe-form";
import { RecipeDetailPanel } from "@/features/recipe/components/recipe-detail-panel";
import { SemiProductList } from "@/features/recipe/components/semi-product-list";
import { SemiProductForm } from "@/features/recipe/components/semi-product-form";
import { SemiProductDetailPanel } from "@/features/recipe/components/semi-product-detail-panel";
import type { RecipeRow } from "@/features/recipe/components/recipe-list";
import type { SemiProductRow } from "@/features/recipe/components/semi-product-list";

type RecipeView = { mode: "list" } | { mode: "new" };
type SemiProductView = { mode: "list" } | { mode: "new" };

export default function RecipesPage() {
  const [recipeView, setRecipeView] = useState<RecipeView>({ mode: "list" });
  const [semiProductView, setSemiProductView] = useState<SemiProductView>({ mode: "list" });
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRow | null>(null);
  const [selectedSemiProduct, setSelectedSemiProduct] = useState<SemiProductRow | null>(null);
  const [activeTab, setActiveTab] = useState("recipes");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRecipeUpdated = () => {
    setSelectedRecipe(null);
    setRefreshKey((k) => k + 1);
  };

  const handleSemiProductUpdated = () => {
    setSelectedSemiProduct(null);
    setRefreshKey((k) => k + 1);
  };

  const renderRecipeTab = () => {
    if (recipeView.mode === "new") {
      return (
        <RecipeForm
          onBack={() => setRecipeView({ mode: "list" })}
          onSaved={() => {
            setRecipeView({ mode: "list" });
            setRefreshKey((k) => k + 1);
          }}
        />
      );
    }

    return (
      <RecipeList
        key={refreshKey}
        onNew={() => setRecipeView({ mode: "new" })}
        onSelect={(recipe) => setSelectedRecipe(recipe)}
      />
    );
  };

  const renderSemiProductTab = () => {
    if (semiProductView.mode === "new") {
      return (
        <SemiProductForm
          onBack={() => setSemiProductView({ mode: "list" })}
          onSaved={() => {
            setSemiProductView({ mode: "list" });
            setRefreshKey((k) => k + 1);
          }}
        />
      );
    }

    return (
      <SemiProductList
        key={refreshKey}
        onNew={() => setSemiProductView({ mode: "new" })}
        onSelect={(item) => setSelectedSemiProduct(item)}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">레시피 관리</h1>
        <p className="text-sm text-gray-500">
          레시피, 반제품, BOM(자재 투입량)을 관리합니다
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="recipes">레시피</TabsTrigger>
          <TabsTrigger value="semi-products">반제품</TabsTrigger>
        </TabsList>
        <TabsContent value="recipes" className="mt-4">
          {renderRecipeTab()}
        </TabsContent>
        <TabsContent value="semi-products" className="mt-4">
          {renderSemiProductTab()}
        </TabsContent>
      </Tabs>

      {/* 레시피 상세 패널 */}
      <Sheet
        open={!!selectedRecipe}
        onOpenChange={(open) => {
          if (!open) setSelectedRecipe(null);
        }}
      >
        <SheetContent side="right" className="w-full p-0 sm:max-w-2xl" aria-describedby={undefined}>
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedRecipe?.name ?? "레시피 상세"}</SheetTitle>
          </SheetHeader>
          {selectedRecipe && (
            <RecipeDetailPanel
              recipe={selectedRecipe}
              onClose={() => setSelectedRecipe(null)}
              onUpdated={handleRecipeUpdated}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* 반제품 상세 패널 */}
      <Sheet
        open={!!selectedSemiProduct}
        onOpenChange={(open) => {
          if (!open) setSelectedSemiProduct(null);
        }}
      >
        <SheetContent side="right" className="w-full p-0 sm:max-w-2xl" aria-describedby={undefined}>
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedSemiProduct?.name ?? "반제품 상세"}</SheetTitle>
          </SheetHeader>
          {selectedSemiProduct && (
            <SemiProductDetailPanel
              semiProduct={selectedSemiProduct}
              onClose={() => setSelectedSemiProduct(null)}
              onUpdated={handleSemiProductUpdated}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
