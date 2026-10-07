const variants = {
    nav: "axiom-logo--nav",
    hero: "axiom-logo--hero",
    footer: "axiom-logo--footer",
};

export default function Axiom40Logo({className = "", variant = "nav", label = "AXIOM 4.0"}) {
    return (
        <svg className={`axiom-logo ${variants[variant]} ${className}`} viewBox="0 0 490 240" fill="currentColor" role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M0 108 19 8h30l19 100H45l-3-21H25l-3 21H0Zm29-39h10l-5-36-5 36Z" />
            <path d="m72 8 21 47L73 108h25l10-32 10 32h25l-21-53 20-47h-25l-9 30-10-30H72Z" />
            <path d="M150 8h23v100h-23z" />
            <path fillRule="evenodd" d="M212 5c-20 0-29 12-29 32v171c0 21 9 31 29 31s29-10 29-31V37c0-20-9-32-29-32Zm0 21c-5 0-6 4-6 12v168c0 8 1 12 6 12s6-4 6-12V38c0-8-1-12-6-12Z" />
            <path d="M252 8h25l13 48 13-48h25v100h-21V57l-9 37h-16l-9-37v51h-21V8Z" />
            <path fillRule="evenodd" d="M361 8h23v57h10v20h-10v23h-22V85h-29V67l28-59Zm1 29-12 28h12V37Z" />
            <path d="M400 87h20v21h-20z" />
            <path fillRule="evenodd" d="M456 5c-21 0-29 12-29 32v43c0 20 8 31 29 31s29-11 29-31V37c0-20-8-32-29-32Zm0 21c-5 0-6 4-6 12v40c0 8 1 12 6 12s6-4 6-12V38c0-8-1-12-6-12Z" />
        </svg>
    );
}
