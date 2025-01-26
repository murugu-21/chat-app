import { LoadingSpinner } from "../../components/LoadingSpinner";

export default function FullPageLoader(): JSX.Element {
  return (
      <div className="w-full h-full flex justify-center items-center">
          <LoadingSpinner />
      </div>
  );
}
