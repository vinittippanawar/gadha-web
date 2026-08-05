import RoomClient from "@/components/RoomClient";

// Kept as a plain server component specifically so it can `await params`
// directly and hand the room code down as an ordinary string prop -- the
// actual room UI (components/RoomClient.tsx) needs hooks and browser APIs,
// so it has to be a client component, and this split avoids ever needing to
// unwrap an async `params` promise from inside one.
export default async function RoomPage(props: PageProps<"/room/[code]">) {
  const { code } = await props.params;
  return <RoomClient code={code.toUpperCase()} />;
}
