"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Headphones,
  LockKeyhole,
  Network,
  PackageCheck,
  RadioTower,
  ShieldCheck,
  Signal,
  Sparkles,
  UsersRound,
  Wifi,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneField, SelectField, TextareaField, TextField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatUgx } from "@/lib/format";
import { UGANDA_PHONE_COUNTRY_CODE } from "@/lib/uganda-phone";
import type { BundleOffer, ServiceRequestRequest } from "@/types/domain";

const topLinks = ["Business", "Wholesale", "Support", "Security"];
const loginRoute = "/auth/login" as Route;
const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Packages", href: "#packages" },
  { label: "How it works", href: "#journey" },
  { label: "Request service", href: "#request-service" },
  { label: "Contact", href: "#contact" },
];
const productStats = [
  { label: "Service model", value: "Bulk data", icon: Network },
  { label: "Provisioning", value: "Fast provisioning", icon: RadioTower },
  { label: "Payments", value: "MoMo, card, PRN, Airtime", icon: ShieldCheck },
];
const productCapabilities = [
  {
    title: "Wholesale data allocation",
    description: "Central bundles for businesses that need to allocate data across many primary and secondary MSISDNs.",
    icon: PackageCheck,
  },
  {
    title: "Account-managed provisioning",
    description: "Customer onboarding, APN validation, secondary number management, and balance visibility in one workflow.",
    icon: UsersRound,
  },
  {
    title: "Secure self-service",
    description: "MFA, passkeys, sessions, account preferences, branded receipts, and payment status updates built into the portal.",
    icon: LockKeyhole,
  },
];
const journeySteps = [
  "Submit your service request with contact and business details.",
  "MTN validates account eligibility, APN details, and primary MSISDN ownership.",
  "Your team receives customer portal access for purchases and secondary number management.",
  "Payments and provisioning status are tracked in real time through the portal.",
];

const fallbackPackages: BundleOffer[] = [
  {
    id: "public-500gb",
    serviceCode: "BDS-500G-30D",
    name: "Wholesale 500 GB",
    volumeTb: 0.5,
    priceUgx: 1250000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "public-1tb",
    serviceCode: "BDS-1T-30D",
    name: "Wholesale 1 TB",
    volumeTb: 1,
    priceUgx: 2300000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "public-2tb",
    serviceCode: "BDS-2T-30D",
    name: "Wholesale 2 TB",
    volumeTb: 2,
    priceUgx: 4300000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: "",
    updatedAt: "",
  },
];

const initialRequest: ServiceRequestRequest = {
  businessName: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: UGANDA_PHONE_COUNTRY_CODE,
  preferredPackageId: "",
  message: "",
};

function packageVolumeLabel(bundle: BundleOffer) {
  return bundle.volumeTb >= 1 ? `${bundle.volumeTb.toLocaleString("en-US")} TB` : `${bundle.volumeTb * 1000} GB`;
}

export function PublicSite() {
  const bundlesQuery = useQuery({ queryKey: ["public-bundles"], queryFn: api.bundles });
  const [serviceRequest, setServiceRequest] = useState<ServiceRequestRequest>(initialRequest);
  const visiblePackages = bundlesQuery.data?.length ? bundlesQuery.data : fallbackPackages;
  const featuredPackage = useMemo(
    () => visiblePackages.find((bundle) => bundle.id === serviceRequest.preferredPackageId) ?? visiblePackages[0],
    [serviceRequest.preferredPackageId, visiblePackages],
  );
  const requestMutation = useMutation({
    mutationFn: api.submitServiceRequest,
    onSuccess: () => setServiceRequest(initialRequest),
  });

  function updateRequestField<TField extends keyof ServiceRequestRequest>(
    field: TField,
    value: ServiceRequestRequest[TField],
  ) {
    setServiceRequest((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="bg-ink/95 px-4 text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-2 text-xs font-semibold uppercase tracking-wide">
            <div className="flex items-center gap-5">
              {topLinks.map((link) => (
                <a key={link} href="#product" className="text-white/80 transition hover:text-primary">
                  {link}
                </a>
              ))}
            </div>
            <span className="hidden text-white/65 md:inline">MTN Bulk Data Wholesale Service</span>
          </div>
        </div>
        <div className="pt-4">
          <div className="mx-auto flex w-[95%] items-center justify-between gap-4 rounded-md bg-primary px-4 py-3 text-primary-foreground shadow-xl sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid size-14 place-items-center rounded-md bg-primary-foreground/10 p-2">
                <span className="relative block h-5 w-10">
                  <Image
                    src="/logos/mtn-logo-black.svg"
                    alt="MTN"
                    fill
                    sizes="40px"
                    className="object-contain"
                    priority
                  />
                </span>
              </span>
              <span className="hidden text-sm font-semibold md:block">Bulk Data Wholesale</span>
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-semibold lg:flex" aria-label="Public navigation">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="transition hover:text-primary-foreground/70">
                  {link.label}
                </a>
              ))}
            </nav>
            <Button asChild size="sm" className="!bg-ink !text-white hover:!bg-ink/85 focus-visible:!bg-ink">
              <Link href={loginRoute}>
                Sign in
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-ink px-4 pb-10 pt-40 text-white md:pb-14 lg:pt-44">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_20%,rgba(255,203,5,0.55),transparent_26%),linear-gradient(110deg,rgba(0,16,32,0.96)_0%,rgba(0,16,32,0.8)_42%,rgba(0,0,0,0.35)_100%)]" />
          <div className="absolute inset-y-0 right-0 -z-10 w-full opacity-70">
            <div className="h-full w-full bg-[linear-gradient(135deg,rgba(255,203,5,0.25)_0_20%,transparent_20%_38%,rgba(3,105,161,0.35)_38%_58%,transparent_58%_75%,rgba(22,101,52,0.35)_75%)]" />
          </div>
          <div className="absolute bottom-10 right-6 hidden w-[44rem] max-w-[48vw] grid-cols-3 gap-3 opacity-95 lg:grid">
            {productStats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div key={stat.label} className="rounded-md border border-white/15 bg-white/12 p-4 backdrop-blur-md">
                  <Icon className="size-5 text-primary" />
                  <p className="mt-4 text-xs font-medium text-white/65">{stat.label}</p>
                  <p className="mt-1 text-lg font-semibold">{stat.value}</p>
                </div>
              );
            })}
          </div>
          <div className="mx-auto w-full max-w-7xl">
            <div className="max-w-3xl">
              <StatusBadge label="For MTN business and wholesale customers" tone="yellow" />
              <h1 className="mt-7 text-5xl font-extrabold leading-none text-primary sm:text-6xl lg:text-7xl">
                Bulk Data Wholesale Service
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-white/85">
                Buy, allocate, and manage bulk data for business fleets, branches, devices, and secondary numbers with
                MTN-backed provisioning and secure self-service.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="min-w-44">
                  <a href="#request-service">
                    Request service
                    <ArrowRight data-icon="inline-end" />
                  </a>
                </Button>
                <Button asChild size="lg" className="min-w-36 !bg-ink !text-white hover:!bg-ink/85 focus-visible:!bg-ink">
                  <Link href={loginRoute}>Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="px-4 py-14">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase text-muted-foreground">Product</p>
              <h2 className="mt-2 text-3xl font-semibold">Built for high-volume business data operations.</h2>
              <p className="mt-3 text-muted-foreground">
                The portal supports account onboarding, primary MSISDN balance checks, package purchase flows, PRN and
                card journeys, branded receipts, reporting, MFA, and customer preferences.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {productCapabilities.map((item) => {
                const Icon = item.icon;

                return (
                  <Panel key={item.title} className="border shadow-sm">
                    <div className="grid size-11 place-items-center rounded-md bg-primary text-primary-foreground">
                      <Icon />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </Panel>
                );
              })}
            </div>
          </div>
        </section>

        <section id="packages" className="bg-[var(--panel-strong)] px-4 py-14">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase text-muted-foreground">Packages</p>
                <h2 className="mt-2 text-3xl font-semibold">Visible wholesale packages.</h2>
                <p className="mt-3 text-muted-foreground">
                  Public package information comes from the same package catalog used by the customer purchase flow.
                </p>
              </div>
              {bundlesQuery.isFetching && <StatusBadge label="Refreshing catalog" tone="blue" />}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {visiblePackages.map((bundle, index) => {
                const selected = serviceRequest.preferredPackageId === bundle.id;

                return (
                  <Panel
                    key={bundle.id}
                    className={cn(
                      "flex min-h-72 flex-col border shadow-sm",
                      index === 1 && "border-primary/70 bg-primary text-primary-foreground",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium opacity-75">{bundle.serviceCode}</p>
                        <h3 className="mt-2 text-xl font-semibold">{bundle.name}</h3>
                      </div>
                      <Wifi className="size-6" />
                    </div>
                    <p className="mt-7 text-4xl font-semibold">{packageVolumeLabel(bundle)}</p>
                    <p className="mt-2 text-sm opacity-75">{bundle.validityDays} days validity</p>
                    <p className="mt-6 text-2xl font-semibold">{formatUgx(bundle.priceUgx)}</p>
                    <Button
                      type="button"
                      className={cn(
                        "mt-auto hover:bg-ink hover:text-white focus-visible:bg-ink focus-visible:text-white",
                        (selected || index === 1) && "bg-ink text-white hover:bg-ink/85",
                      )}
                      onClick={() => {
                        updateRequestField("preferredPackageId", bundle.id);
                        document.getElementById("request-service")?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      {selected ? "Selected package" : "Request this package"}
                    </Button>
                  </Panel>
                );
              })}
            </div>
          </div>
        </section>

        <section id="journey" className="px-4 py-14">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase text-muted-foreground">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold">A clear path from request to provisioning.</h2>
              <p className="mt-3 text-muted-foreground">
                The portal is prepared for live backend integration and real-time payment status updates while keeping
                the customer journey simple.
              </p>
            </div>
            <div className="grid gap-3">
              {journeySteps.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-md border border-border bg-card p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="self-center text-sm font-medium leading-6">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="request-service" className="bg-ink px-4 py-14 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">Request service</p>
              <h2 className="mt-2 text-3xl font-semibold">Tell us where to start.</h2>
              <p className="mt-3 leading-7 text-white/75">
                Share your business contact details and preferred package. The service team can use this lead to open an
                account registration workflow.
              </p>
              <div className="mt-8 grid gap-3">
                {[
                  "Dedicated business onboarding",
                  "APN and primary MSISDN validation",
                  "Customer portal access after activation",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-medium text-white/85">
                    <CheckCircle2 className="size-5 text-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <form
              className="grid gap-4 rounded-md bg-white p-4 text-foreground shadow-2xl sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                requestMutation.mutate(serviceRequest);
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Business name"
                  required
                  value={serviceRequest.businessName}
                  onValueChange={(value) => updateRequestField("businessName", value)}
                />
                <TextField
                  label="Contact person"
                  required
                  value={serviceRequest.contactPerson}
                  onValueChange={(value) => updateRequestField("contactPerson", value)}
                />
                <TextField
                  label="Email"
                  required
                  type="email"
                  value={serviceRequest.contactEmail}
                  onValueChange={(value) => updateRequestField("contactEmail", value)}
                />
                <PhoneField
                  label="Phone"
                  required
                  value={serviceRequest.contactPhone}
                  onValueChange={(value) => updateRequestField("contactPhone", value)}
                />
              </div>
              <SelectField
                label="Preferred package"
                value={serviceRequest.preferredPackageId ?? ""}
                onValueChange={(value) => updateRequestField("preferredPackageId", value)}
                options={[
                  { label: "Not sure yet", value: "" },
                  ...visiblePackages.map((bundle) => ({
                    label: `${bundle.name} - ${formatUgx(bundle.priceUgx)}`,
                    value: bundle.id,
                  })),
                ]}
              />
              <TextareaField
                label="Message"
                value={serviceRequest.message ?? ""}
                placeholder="Tell us about expected number of users, sites, or primary MSISDNs."
                onValueChange={(value) => updateRequestField("message", value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {featuredPackage ? `Selected: ${featuredPackage.name}` : "A service specialist will recommend a package."}
                </p>
                <Button type="submit" disabled={requestMutation.isPending}>
                  {requestMutation.isPending ? "Submitting..." : "Submit request"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
              {requestMutation.isSuccess && (
                <p className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
                  Request submitted. MTN can now contact the business contact for onboarding.
                </p>
              )}
              {requestMutation.isError && (
                <p className="rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-900">
                  {requestMutation.error.message}
                </p>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer id="contact" className="bg-primary px-4 py-10 text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="relative block h-7 w-[58px]">
                <Image
                  src="/logos/mtn-logo-black.svg"
                  alt="MTN"
                  fill
                  sizes="58px"
                  className="object-contain"
                />
              </span>
              <span className="font-semibold">Bulk Data Wholesale Service</span>
            </div>
            <p className="max-w-2xl text-sm leading-6">
              Project links: packages, request service, customer portal, security settings, payments, reports, and
              account preferences.
            </p>
          </div>
          <div className="grid gap-2 text-sm font-medium sm:grid-cols-2">
            <span className="flex items-center gap-2">
              <Headphones className="size-4" />
              0771 001 000
            </span>
            <span className="flex items-center gap-2">
              <Building2 className="size-4" />
              Plot 69-71 Jinja Road
            </span>
            <span className="flex items-center gap-2">
              <Signal className="size-4" />
              Toll free 100
            </span>
            <span className="flex items-center gap-2">
              <Sparkles className="size-4" />
              customerservice.ug@mtn.com
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
