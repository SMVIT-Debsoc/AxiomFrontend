export default function Sculpture({className = "", variant = "portrait", eager = false}) {
    return (
        <img
            className={`axiom-sculpture axiom-sculpture--${variant} ${className}`}
            src="/brand/mother-goddess-960.webp"
            srcSet="/brand/mother-goddess-480.webp 480w, /brand/mother-goddess-960.webp 960w"
            sizes="(max-width: 640px) 145px, (max-width: 1024px) 241px, 260px"
            width="960"
            height="2673"
            alt=""
            aria-hidden="true"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
        />
    );
}
