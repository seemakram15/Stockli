export function PageLoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[calc(100svh-8rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-5 text-center">
        <div
          className="size-14 animate-spin rounded-full border-4 border-muted border-t-primary"
          aria-hidden
        />
        <p className="text-2xl font-normal tracking-normal text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  );
}
