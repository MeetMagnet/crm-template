"use client";

type ActionCheckProps = {
  done: boolean;
  onToggle: () => void;
};

export function ActionCheck({ done, onToggle }: ActionCheckProps) {
  const title = done ? "Marquer comme à faire" : "Marquer comme terminé";
  return (
    <button
      type="button"
      className={`action-check ${done ? "done" : "open"}`}
      title={title}
      aria-label={title}
      aria-pressed={done}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onToggle();
      }}
    >
      {done ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : null}
    </button>
  );
}
