
export default function Placeholder({ title }) {
    return (
        <div className="container mx-auto px-6 py-32 text-center">
            <h1 className="text-4xl font-bold mb-4">{title}</h1>
            <p className="text-muted-foreground">This page is under construction.</p>
        </div>
    );
}
