interface SkeletonProps {
  className?: string;
}

const Skeleton = ({ className = "" }: SkeletonProps) => {
  return (
    <div
      className={`skeleton-shimmer rounded-md bg-white/10 ring-1 ring-white/10 ${className}`}
    />
  );
};

export default Skeleton;