import React, { useState } from "react";
import { LoadingSpinner } from "./LoadingSpinner";
import { toast } from "sonner";
import { cn } from "../utils/cnHelper";

export type ButtonType = "button" | "submit" | "reset";

function Button({
  onClick,
  disabled,
  type,
  className,
  children,
}: {
  onClick: (e: React.MouseEvent<HTMLElement>) => Promise<void>;
  children: JSX.Element | JSX.Element[];
  type?: ButtonType;
  disabled?: boolean;
  className?: string;
}): JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const clickHandler = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      await onClick(e);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message)
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type={type ? type : "button"}
      className={cn(`cursor-pointer disabled:cursor-not-allowed flex gap-1 justify-center items-center`, className)}
      onClick={clickHandler}
      disabled={isLoading || disabled}
    >
      {isLoading ? <LoadingSpinner /> : <></>}
      {children}
    </button>
  );
}

export default Button;
