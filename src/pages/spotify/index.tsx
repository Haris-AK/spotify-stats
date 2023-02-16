import { useSession } from "next-auth/react";
import { api } from "../../utils/api";
import { prisma } from "../../server/db";
import { getServerAuthSession } from "../../server/auth";

export default function Spotify({ token }: any) {
  const { data: session, status } = useSession();
  const access_token = token.access_token;
  if (status === "authenticated") {
    return (
      <div className="flex flex-wrap bg-green-500">
        <div className="float-left my-3 mx-3 rounded-lg bg-gray-500 p-2">
          <p>Signed in as {session.user.name}</p>
        </div>
      </div>
    );
  }

  return <a href="/api/auth/signin">Sign in</a>;
}

export async function getServerSideProps(context: any) {
  const session = await getServerAuthSession(context);
  const userID = session?.user.id;
  console.log(userID);
  const token = await prisma.account.findFirst({
    where: {
      userId: userID,
    },
    select: {
      access_token: true,
    },
  });
  return {
    props: {
      token: token,
    },
  };
}
