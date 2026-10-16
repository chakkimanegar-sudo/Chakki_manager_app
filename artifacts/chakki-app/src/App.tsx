import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/dashboard";
import AddRecord from "@/pages/add-record";
import Records from "@/pages/records";
import Khata from "@/pages/khata";
import KhataDetail from "@/pages/khata-detail";
import Settings from "@/pages/settings";
import Reports from "@/pages/reports";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/add" component={AddRecord} />
        <Route path="/edit/:id" component={AddRecord} />
        <Route path="/records" component={Records} />
        <Route path="/khata" component={Khata} />
        <Route path="/khata/:id" component={KhataDetail} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL === "./" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
