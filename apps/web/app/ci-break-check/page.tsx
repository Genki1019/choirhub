import { useState } from "react";

export default function Page() {
  const [count] = useState(0);
  return <p>{count}</p>;
}
