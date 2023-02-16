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

// Server side renders data, takes the current users session, and then uses
// their id to get their corresponding access token, once it has the users access
// token it calls the functions below to get their listening data, once it has this
// it returns it back to the client to be visualised and manipulated
export async function getServerSideProps(context: any) {
  const session = await getServerAuthSession(context);
  const userID = session?.user.id;
  const token = await prisma.account.findFirst({
    where: {
      userId: userID,
    },
    select: {
      access_token: true,
    },
  });
  const top_tracks = await getUsersTopItems("tracks", token?.access_token);
  const top_artists = await getUsersTopItems("artists", token?.access_token);
  return {
    props: {
      top_tracks: top_tracks,
      top_artists: top_artists,
    },
  };
}

// Generates the URL request based on the url passed in, takes in an access token and
// automatically appends it the header so it is not requried manually each time
export async function generateRequest(url: string, access_token: any) {
  let myHeaders = new Headers({
    Authorization: `Bearer ${access_token}`,
    "Content-type": "application/json",
  });
  const res = await fetch(url, {
    headers: myHeaders,
  });
  return res.json();
}

// Uses the generateRequest function, passing in the URL corresponding to the
// API endpoint which passes back the top tracks / artists of the user based on
// a parameter
export async function getUsersTopItems(
  type: "artists" | "tracks",
  access_token: any
) {
  const res = generateRequest(
    `https://api.spotify.com/v1/me/top/${type}`,
    access_token
  );
  return res;
}

// Passes the following artists endpoint to the generateRequest
// function and returns any data back
export async function getFollowedArtists(access_token: any) {
  const res = generateRequest(
    `https://api.spotify.com/v1/me/following?type=artist`,
    access_token
  );
  return res;
}
