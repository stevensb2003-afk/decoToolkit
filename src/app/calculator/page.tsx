
"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { UserProfile } from "@/lib/types";
import { doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Home, BadgePercent, BadgePlus, Boxes, Package } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


const formatCurrency = (value: number) => {
  return value.toLocaleString('es-CR', {
    style: 'currency',
    currency: 'CRC', // Costa Rican Colón
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

function DiscountCalculator() {
  const [ivaRate, setIvaRate] = useState("13");
  const [originalPrice, setOriginalPrice] = useState("");
  const [desiredFinalPrice, setDesiredFinalPrice] = useState("");
  const [useOriginalAsFinal, setUseOriginalAsFinal] = useState(false);

  const [newPrice, setNewPrice] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);

  const [hasCalculated, setHasCalculated] = useState(false);

  useEffect(() => {
    if (useOriginalAsFinal) {
      setDesiredFinalPrice(originalPrice);
    }
  }, [originalPrice, useOriginalAsFinal]);

  const calculatePrices = () => {
    const ivaRateNum = parseFloat(ivaRate);
    const originalPriceNum = parseFloat(originalPrice);
    const desiredFinalPriceNum = parseFloat(desiredFinalPrice);

    if (isNaN(ivaRateNum) || isNaN(originalPriceNum) || isNaN(desiredFinalPriceNum) || originalPriceNum <= 0) {
      if (hasCalculated) {
        setNewPrice(0);
        setDiscountAmount(0);
        setDiscountPercentage(0);
      }
      return;
    }

    setHasCalculated(true);
    const basePrice = desiredFinalPriceNum / (1 + ivaRateNum / 100);
    setNewPrice(basePrice);
    const discount = originalPriceNum - desiredFinalPriceNum;
    setDiscountAmount(discount);
    const percentage = (discount / originalPriceNum) * 100;
    setDiscountPercentage(percentage);
  };

  useEffect(() => {
    calculatePrices();
  }, [ivaRate, originalPrice, desiredFinalPrice, useOriginalAsFinal]);

  const handleClear = () => {
    setIvaRate("13");
    setOriginalPrice("");
    setDesiredFinalPrice("");
    setNewPrice(0);
    setDiscountAmount(0);
    setDiscountPercentage(0);
    setHasCalculated(false);
    setUseOriginalAsFinal(false);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <form className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="ivaRate">Tasa de IVA (%)</Label>
            <Input id="ivaRate" type="number" step="any" placeholder="13" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="originalPrice">Precio Original (con IVA)</Label>
            <Input id="originalPrice" type="number" step="any" placeholder="Ej: 10000" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="use-original-price" checked={useOriginalAsFinal} onCheckedChange={(checked) => setUseOriginalAsFinal(checked as boolean)} />
              <Label htmlFor="use-original-price" className="text-sm font-normal text-muted-foreground">Calcular precio base (sin descuento)</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desiredFinalPrice">Precio Final Deseado (con IVA)</Label>
              <Input id="desiredFinalPrice" type="number" step="any" placeholder="Ej: 8500" value={desiredFinalPrice} onChange={(e) => setDesiredFinalPrice(e.target.value)} disabled={useOriginalAsFinal} />
            </div>
          </div>
        </form>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg space-y-6 h-full">
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">Nuevo Precio para tu Sistema:</p>
            <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(newPrice)}</p>
            <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 tracking-widest">PRECIO SIN IVA</p>
          </div>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">Monto del Descuento:</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(discountAmount)}</p>
          </div>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">Porcentaje de Descuento:</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{discountPercentage.toFixed(2)}%</p>
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <Button onClick={handleClear} variant="destructive" size="lg" className="px-12 bg-red-500 hover:bg-red-600">Limpiar</Button>
      </div>
    </div>
  );
}

function AddVatCalculator() {
  const [basePrice, setBasePrice] = useState("");
  const [ivaRate, setIvaRate] = useState("13");
  const [finalPrice, setFinalPrice] = useState(0);
  const [ivaAmount, setIvaAmount] = useState(0);

  useEffect(() => {
    const basePriceNum = parseFloat(basePrice);
    const ivaRateNum = parseFloat(ivaRate);
    if (!isNaN(basePriceNum) && !isNaN(ivaRateNum)) {
      const iva = basePriceNum * (ivaRateNum / 100);
      setIvaAmount(iva);
      setFinalPrice(basePriceNum + iva);
    } else {
      setIvaAmount(0);
      setFinalPrice(0);
    }
  }, [basePrice, ivaRate]);

  const handleClear = () => {
    setBasePrice("");
    setIvaRate("13");
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <form className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="basePrice">Precio Base (sin IVA)</Label>
            <Input id="basePrice" type="number" step="any" placeholder="Ej: 8849.56" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ivaRateVat">Tasa de IVA (%)</Label>
            <Input id="ivaRateVat" type="number" step="any" placeholder="13" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} />
          </div>
        </form>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg space-y-6 h-full">
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">Precio Final a mostrar:</p>
            <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(finalPrice)}</p>
            <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 tracking-widest">PRECIO CON IVA</p>
          </div>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">Monto del IVA:</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(ivaAmount)}</p>
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <Button onClick={handleClear} variant="destructive" size="lg" className="px-12 bg-red-500 hover:bg-red-600">Limpiar</Button>
      </div>
    </div>
  );
}

function InventoryCalculator() {
  const [unitsPerBox, setUnitsPerBox] = useState("");
  const [boxCount, setBoxCount] = useState("");
  const [looseUnits, setLooseUnits] = useState("");
  const [totalUnits, setTotalUnits] = useState(0);

  useEffect(() => {
    const unitsPerBoxNum = parseInt(unitsPerBox) || 0;
    const boxCountNum = parseInt(boxCount) || 0;
    const looseUnitsNum = parseInt(looseUnits) || 0;
    setTotalUnits(unitsPerBoxNum * boxCountNum + looseUnitsNum);
  }, [unitsPerBox, boxCount, looseUnits]);

  const handleClear = () => {
    setUnitsPerBox("");
    setBoxCount("");
    setLooseUnits("");
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <form className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="unitsPerBox">Unidades por Caja</Label>
            <Input id="unitsPerBox" type="number" placeholder="Ej: 12" value={unitsPerBox} onChange={(e) => setUnitsPerBox(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="boxCount">Cantidad de Cajas</Label>
            <Input id="boxCount" type="number" placeholder="Ej: 5" value={boxCount} onChange={(e) => setBoxCount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="looseUnits">Unidades Sueltas</Label>
            <Input id="looseUnits" type="number" placeholder="Ej: 3" value={looseUnits} onChange={(e) => setLooseUnits(e.target.value)} />
          </div>
        </form>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-sm text-blue-800 dark:text-blue-300">Total de Unidades:</p>
            <p className="text-6xl font-bold text-blue-900 dark:text-blue-100">{totalUnits.toLocaleString('en-US')}</p>
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <Button onClick={handleClear} variant="destructive" size="lg" className="px-12 bg-red-500 hover:bg-red-600">Limpiar</Button>
      </div>
    </div>
  );
}

function PackagingCalculator() {
  const [totalUnitsStr, setTotalUnitsStr] = useState("");
  const [unitsPerBoxStr, setUnitsPerBoxStr] = useState("");

  const [fullBoxes, setFullBoxes] = useState(0);
  const [remainingUnits, setRemainingUnits] = useState(0);

  useEffect(() => {
    const totalUnits = parseInt(totalUnitsStr) || 0;
    const unitsPerBox = parseInt(unitsPerBoxStr) || 0;

    if (unitsPerBox > 0) {
      setFullBoxes(Math.floor(totalUnits / unitsPerBox));
      setRemainingUnits(totalUnits % unitsPerBox);
    } else {
      setFullBoxes(0);
      setRemainingUnits(totalUnits);
    }
  }, [totalUnitsStr, unitsPerBoxStr]);

  const handleClear = () => {
    setTotalUnitsStr("");
    setUnitsPerBoxStr("");
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <form className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="totalUnitsPack">Total de Unidades a Empacar</Label>
            <Input id="totalUnitsPack" type="number" placeholder="Ej: 150" value={totalUnitsStr} onChange={(e) => setTotalUnitsStr(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unitsPerBoxPack">Unidades por Caja</Label>
            <Input id="unitsPerBoxPack" type="number" placeholder="Ej: 12" value={unitsPerBoxStr} onChange={(e) => setUnitsPerBoxStr(e.target.value)} />
          </div>
        </form>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg space-y-6 h-full">
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">Cajas Completas:</p>
            <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">{fullBoxes.toLocaleString('en-US')}</p>
          </div>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-300">Unidades Sueltas (Sobrantes):</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{remainingUnits.toLocaleString('en-US')}</p>
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <Button onClick={handleClear} variant="destructive" size="lg" className="px-12 bg-red-500 hover:bg-red-600">Limpiar</Button>
      </div>
    </div>
  );
}


export default function PriceCalculatorPage() {
  const [activeTab, setActiveTab] = useState("discount");
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const profileRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(profileRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (!isProfileLoading && profile && !isUserLoading && user) {
      const allowedModules = profile.permissions?.allowedModules || [];
      const isAdmin = profile.isAdmin || false;
      if (!isAdmin && !allowedModules.includes('calculator')) {
        router.push('/');
      }
    }
  }, [isProfileLoading, profile, isUserLoading, user, router]);

  if (isUserLoading || isProfileLoading) {
    return null; // Or a loader
  }

  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-5xl p-4 md:p-8 flex flex-col pt-16">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-6">
              <TooltipProvider>
                <TabsList>
                  <TabsTrigger value="discount" className="px-4 rounded-md border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BadgePercent />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Calculadora sin IVA</p>
                      </TooltipContent>
                    </Tooltip>
                  </TabsTrigger>
                  <TabsTrigger value="addVat" className="px-4 rounded-md border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BadgePlus />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Calculadora con IVA</p>
                      </TooltipContent>
                    </Tooltip>
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="px-4 rounded-md border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Boxes />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total desde Cajas</p>
                      </TooltipContent>
                    </Tooltip>
                  </TabsTrigger>
                  <TabsTrigger value="packaging" className="px-4 rounded-md border-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Package />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cálculo de Empaque</p>
                      </TooltipContent>
                    </Tooltip>
                  </TabsTrigger>
                </TabsList>
              </TooltipProvider>
            </div>
            <Card className="w-full shadow-2xl rounded-2xl">
              <CardHeader className="text-center items-center relative pt-8">
                <div className="absolute top-4 right-4 flex gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href="/"><Home className="h-5 w-5 text-muted-foreground" /></Link>
                  </Button>
                </div>
                <Image src="/favicon_azul.png" alt="DecoInnova Logo" width={48} height={48} className="mb-4" />
                <CardTitle className="text-3xl font-bold font-headline">
                  {activeTab === 'discount' && "Calculadora Inversa (Descuento)"}
                  {activeTab === 'addVat' && "Agregar IVA"}
                  {activeTab === 'inventory' && "Totalizador de Inventario"}
                  {activeTab === 'packaging' && "Cálculo de Empaque"}
                </CardTitle>
                <CardDescription>
                  {activeTab === 'discount' && "Calcula el precio sin IVA necesario para llegar a un precio final específico."}
                  {activeTab === 'addVat' && "Calcula el precio final de un producto o servicio después de sumarle el impuesto."}
                  {activeTab === 'inventory' && "Calcula el total de unidades a partir de la cantidad de cajas y unidades sueltas."}
                  {activeTab === 'packaging' && "Introduce el total de unidades y las unidades por caja para saber cuántas cajas calcular."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <TabsContent value="discount">
                  <DiscountCalculator />
                </TabsContent>
                <TabsContent value="addVat">
                  <AddVatCalculator />
                </TabsContent>
                <TabsContent value="inventory">
                  <InventoryCalculator />
                </TabsContent>
                <TabsContent value="packaging">
                  <PackagingCalculator />
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </div>
      </main>
    </>
  );
}

