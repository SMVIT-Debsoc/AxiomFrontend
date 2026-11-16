import {useEffect} from "react";
import {useLocation} from "react-router-dom";
import {pageMetadata} from "../config/seo.js";

export default function PageMetadata() {
    const {pathname} = useLocation();

    useEffect(() => {
        const tags = pageMetadata(pathname);
        const elements = tags.map(({tag, attrs, children}) => {
            const element = document.createElement(tag);
            for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
            if (children) element.textContent = children;
            return element;
        });
        document.head.querySelectorAll("[data-page-metadata]").forEach(element => element.remove());
        document.head.append(...elements);
    }, [pathname]);

    return null;
}
