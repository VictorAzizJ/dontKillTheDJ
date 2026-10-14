import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaClient, EventStatus } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_SLUG = "neon-room-friday";

async function main() {
  const email = (process.env.DEMO_DJ_EMAIL ?? "dj@neonroom.local").toLowerCase();
  const password = process.env.DEMO_DJ_PASSWORD ?? "crowdcontrol";
  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      name: "DJ Vega",
    },
    create: {
      email,
      passwordHash,
      name: "DJ Vega",
      djProfile: {
        create: {
          stageName: "DJ Vega",
          bio: "House and late-night neon.",
        },
      },
    },
    include: { djProfile: true },
  });

  let djProfile = user.djProfile;
  if (!djProfile) {
    djProfile = await prisma.dJProfile.create({
      data: {
        userId: user.id,
        stageName: "DJ Vega",
        bio: "House and late-night neon.",
      },
    });
  }

  const venue = await prisma.venue.upsert({
    where: { id: "seed-venue-neon-room" },
    update: {
      name: "Neon Room",
      address: "120 Pulse Ave",
      city: "Brooklyn",
    },
    create: {
      id: "seed-venue-neon-room",
      name: "Neon Room",
      address: "120 Pulse Ave",
      city: "Brooklyn",
    },
  });

  await prisma.event.upsert({
    where: { slug: DEMO_SLUG },
    update: {
      name: "Friday Night Live",
      status: EventStatus.LIVE,
      venueId: venue.id,
      djProfileId: djProfile.id,
      startedAt: new Date(),
      endedAt: null,
    },
    create: {
      name: "Friday Night Live",
      slug: DEMO_SLUG,
      status: EventStatus.LIVE,
      venueId: venue.id,
      djProfileId: djProfile.id,
      startedAt: new Date(),
    },
  });

  console.log("Seeded demo data:");
  console.log(`  Venue: Neon Room`);
  console.log(`  DJ:    DJ Vega (${email})`);
  console.log(`  Event: Friday Night Live → /e/${DEMO_SLUG}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
