import {FIGURES} from "./figures";

export default function Sculpture({className = "", variant = "portrait", figure = "mother-goddess", eager = false}) {
    const data = FIGURES[figure] || FIGURES["mother-goddess"];
    const largest = data.sources[data.sources.length - 1];
    return (
        <img
            className={`axiom-sculpture axiom-sculpture--${variant} ${className}`}
            src={largest[0]}
            srcSet={data.sources.map(([url, width]) => `${url} ${width}w`).join(", ")}
            sizes="(max-width: 640px) 145px, (max-width: 1024px) 241px, 260px"
            width={data.width}
            height={data.height}
            alt=""
            aria-hidden="true"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
        />
    );
}
