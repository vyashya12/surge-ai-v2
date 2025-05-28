import React, { Dispatch, SetStateAction, useState } from "react";
import { Button } from "./button";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

interface PaginationProps {
  active: number;
  setActive: Dispatch<SetStateAction<number>>;
}

export const DefaultPagination: React.FC<PaginationProps> = ({
  active,
  setActive,
}) => {
  const getItemProps = (index: number) =>
    ({
      variant: active === index ? "filled" : "text",
      color: "gray",
      onClick: () => setActive(index),
    } as any);

  const next = () => {
    if (active === 5) return;

    setActive(active + 1);
  };

  const prev = () => {
    if (active === 1) return;

    setActive(active - 1);
  };

  return (
    <div className="flex items-center gap-4 mt-4">
      <Button
        className="flex items-center gap-2"
        onClick={prev}
        disabled={active === 1}
      >
        <ArrowLeftIcon strokeWidth={2} className="h-4 w-4" /> Previous
      </Button>
      <div className="flex items-center gap-2">
        <Button {...getItemProps(1)}>1</Button>
        <Button {...getItemProps(2)}>2</Button>
        <Button {...getItemProps(3)}>3</Button>
        <Button {...getItemProps(4)}>4</Button>
        <Button {...getItemProps(5)}>5</Button>
      </div>
      <Button
        className="flex items-center gap-2"
        onClick={next}
        disabled={active === 5}
      >
        Next
        <ArrowRightIcon strokeWidth={2} className="h-4 w-4" />
      </Button>
    </div>
  );
};
