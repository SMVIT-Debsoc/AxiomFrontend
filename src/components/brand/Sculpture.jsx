import {FIGURES, HERO_SCULPTURE_SIZES, sculptureSrcSet} from "./figures";

export default function Sculpture({
    className = "", variant = "portrait", figure = "shiva-mahadeva", eager = false, sizes = HERO_SCULPTURE_SIZES
}) {
    const data = FIGURES[figure] || FIGURES["shiva-mahadeva"];
    const largest = data.sources[data.sources.length - 1];
    return (
        <img
            className={`axiom-sculpture axiom-sculpture--${variant} ${className}`}
            src={largest[0]}
            srcSet={sculptureSrcSet(data.sources)}
            sizes={sizes}
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
