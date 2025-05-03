import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4">
        Welcome to My Next.js + shadcn/ui App
      </h1>
      <Button variant="default" size="lg">
        Click Me
      </Button>
    </div>
  );
}
