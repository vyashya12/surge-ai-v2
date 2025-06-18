"use client";

import React from "react";
import { Button } from "./button";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

interface DefaultPaginationProps {
  /** Current active page (1-based index) */
  active: number;

  /** Function to update the active page */
  setActive: React.Dispatch<React.SetStateAction<number>>;

  /** Total number of items in the dataset */
  totalItems: number;

  /** Items to display per page */
  itemsPerPage: number;

  /** Max number of page buttons to show (default = 5) */
  maxVisible?: number;
}

export const DefaultPagination: React.FC<DefaultPaginationProps> = ({
  active,
  setActive,
  totalItems,
  itemsPerPage,
  maxVisible = 5,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handlePrev = () => {
    if (active > 1) setActive(active - 1);
  };

  const handleNext = () => {
    if (active < totalPages) setActive(active + 1);
  };

  const renderPageButtons = () => {
    const buttons = [];

    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, active - half);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      buttons.push(
        <Button
          key={i}
          onClick={() => setActive(i)}
          variant={i === active ? "default" : "outline"}
          aria-current={i === active ? "page" : undefined}
          className="w-9 h-9 p-0 text-sm"
        >
          {i}
        </Button>
      );
    }

    return buttons;
  };

  return (
    <div className="flex items-center gap-4 mt-4">
      <Button
        onClick={handlePrev}
        disabled={active === 1}
        variant="outline"
        className="flex items-center gap-1"
        aria-label="Previous page"
      >
        <ArrowLeftIcon strokeWidth={2} className="h-4 w-4" />
        Prev
      </Button>

      <div className="flex items-center gap-1">{renderPageButtons()}</div>

      <Button
        onClick={handleNext}
        disabled={active === totalPages}
        variant="outline"
        className="flex items-center gap-1"
        aria-label="Next page"
      >
        Next
        <ArrowRightIcon strokeWidth={2} className="h-4 w-4" />
      </Button>
    </div>
  );
};
