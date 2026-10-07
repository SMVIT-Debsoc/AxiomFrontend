import Axiom40Logo from "./brand/Axiom40Logo";
import LoadingIndicator from "./ui/LoadingIndicator";

export function Preloader() {
  return (
    <div className="axiom-loading" aria-hidden="true">
      <Axiom40Logo variant="hero" />
      <LoadingIndicator label="The art of articulation" />
    </div>
  );
}

export default Preloader;
