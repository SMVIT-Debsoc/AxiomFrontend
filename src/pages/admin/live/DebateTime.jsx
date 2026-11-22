import {formatTimeIST} from "../../../lib/utils";

export default function DebateTime({startTime, endTime}) {
    if (!startTime && !endTime) return <span>Time not assigned</span>;

    return (
        <span>
            {startTime ? (
                <time dateTime={startTime}>{formatTimeIST(startTime)}</time>
            ) : "Until "}
            {startTime && endTime && " – "}
            {endTime && <time dateTime={endTime}>{formatTimeIST(endTime)}</time>}
            {" IST"}
        </span>
    );
}
