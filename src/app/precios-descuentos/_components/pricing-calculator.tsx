
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Truck, CreditCard, Banknote, MapPin, Percent, TriangleAlert } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { DiscountRule, SaleCalculationParams, PaymentMethod, DeliveryMode, TransportRange, PricingSettings } from '@/lib/pricing-types';

interface CalculationScenario {
    ruleName: string;
    maxDiscount: number;
    transportPrice: number;
    totalDiscounted: number;
    isFreeTransport: boolean;
    transportBenefitText: string;
    isDefault?: boolean;
}

export function PricingCalculator() {
    const firestore = useFirestore();
    const [params, setParams] = useState<SaleCalculationParams>({
        saleAmount: 0,
        paymentMethod: 'Efectivo',
        deliveryMode: 'Local',
        distanceKm: 0,
    });

    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'pricing_settings', 'global');
    }, [firestore]);
    const { data: settings } = useDoc<PricingSettings>(settingsRef);

    const rulesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'pricing_rules'), orderBy('minAmount', 'desc'));
    }, [firestore]);
    const { data: rules } = useCollection<DiscountRule>(rulesQuery);

    const roundToNext5 = (km: number) => {
        if (km <= 0) return 0;
        return Math.ceil(km / 5) * 5;
    };

    const calculationScenarios = useMemo(() => {
        const scenarios: CalculationScenario[] = [];
        const roundedKm = roundToNext5(params.distanceKm || 0);

        // Find base transport price
        let baseTransportPrice = 0;
        let foundRange = false;
        if (params.deliveryMode === 'Domicilio') {
            const costPerKm = settings?.costPerKm || 0;
            baseTransportPrice = (params.distanceKm || 0) * costPerKm;
            foundRange = true; // Always true now as long as we have a cost
        } else if (params.deliveryMode === 'Local' || params.deliveryMode === 'Encomienda') {
            baseTransportPrice = 0;
            foundRange = true;
        }

        // 1. Default scenario (No rules)
        scenarios.push({
            ruleName: "Sin Descuento",
            maxDiscount: 0,
            transportPrice: baseTransportPrice,
            totalDiscounted: params.saleAmount,
            isFreeTransport: false,
            transportBenefitText: foundRange || params.deliveryMode === 'Local' ? "Precio estándar" : "Rango no definido",
            isDefault: true
        });

        if (!rules) return { scenarios, missingTransport: params.deliveryMode === 'Domicilio' && !foundRange && (params.distanceKm || 0) > 0, noRules: true };

        // 2. Applicable rules
        rules.filter(r => r.isActive).forEach(rule => {
            // Check Amount Condition
            let amountOk = false;
            if (rule.amountCondition === 'min') {
                amountOk = params.saleAmount >= rule.minAmount;
            } else if (rule.amountCondition === 'max') {
                amountOk = params.saleAmount <= rule.minAmount;
            } else if (rule.amountCondition === 'between') {
                amountOk = params.saleAmount >= rule.minAmount && params.saleAmount <= (rule.maxAmount || Infinity);
            }

            // Check Distance Condition
            let distanceOk = false;
            if (params.deliveryMode !== 'Domicilio') {
                distanceOk = true;
            } else {
                const dist = params.distanceKm || 0;
                if (rule.distanceCondition === 'min') {
                    distanceOk = dist >= rule.minDistance;
                } else if (rule.distanceCondition === 'max') {
                    distanceOk = dist <= rule.minDistance;
                } else if (rule.distanceCondition === 'between') {
                    distanceOk = dist >= rule.minDistance && dist <= (rule.maxDistance || Infinity);
                }
            }

            const paymentOk = !rule.paymentMethods ||
                rule.paymentMethods.length === 0 ||
                rule.paymentMethods.includes('all') ||
                (params.paymentMethod && rule.paymentMethods.includes(params.paymentMethod as any));

            if (amountOk && distanceOk && paymentOk) {
                let finalTransportPrice = baseTransportPrice;
                let tBenefitText = foundRange ? "Precio estándar" : "Rango no definido";
                let isFree = false;

                if (rule.transportBenefitType === 'free') {
                    finalTransportPrice = 0;
                    tBenefitText = "¡Gratis!";
                    isFree = true;
                } else if (rule.transportBenefitType === 'percentage' && rule.transportBenefitValue) {
                    finalTransportPrice = baseTransportPrice * (1 - rule.transportBenefitValue / 100);
                    tBenefitText = `${rule.transportBenefitValue}% de ahorro`;
                } else if (rule.transportBenefitType === 'fixed' && rule.transportBenefitValue !== undefined) {
                    finalTransportPrice = rule.transportBenefitValue;
                    tBenefitText = `Precio fijo: ₡${rule.transportBenefitValue.toLocaleString()}`;
                }

                scenarios.push({
                    ruleName: rule.name,
                    maxDiscount: rule.discountPercent,
                    transportPrice: finalTransportPrice,
                    totalDiscounted: params.saleAmount * (1 - rule.discountPercent / 100),
                    isFreeTransport: isFree,
                    transportBenefitText: tBenefitText
                });
            }
        });

        // Sort: Best rules first (highest discount or lowest transport)
        const sortedScenarios = scenarios.sort((a, b) => {
            if (a.isDefault) return 1;
            if (b.isDefault) return -1;
            return (b.maxDiscount - a.maxDiscount) || (a.transportPrice - b.transportPrice);
        });

        return {
            scenarios: sortedScenarios,
            missingTransport: params.deliveryMode === 'Domicilio' && !settings?.costPerKm && (params.distanceKm || 0) > 0,
            noRules: scenarios.length === 1
        };
    }, [params, rules, settings]);

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-lg border-2">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" />
                        Datos de la Venta
                    </CardTitle>
                    <CardDescription>
                        Ingresa los parámetros para calcular el descuento.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="saleAmount">Monto Total (Sin Descuento)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">₡</span>
                            <Input
                                id="saleAmount"
                                type="number"
                                placeholder="0.00"
                                className="pl-8 text-lg font-semibold"
                                value={params.saleAmount === 0 ? '' : params.saleAmount}
                                onChange={(e) => setParams({ ...params, saleAmount: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Método de Pago</Label>
                        <Select
                            value={params.paymentMethod}
                            onValueChange={(val: PaymentMethod) => setParams({ ...params, paymentMethod: val })}
                        >
                            <SelectTrigger>
                                <div className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    <SelectValue placeholder="Seleccionar método" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Efectivo">Efectivo</SelectItem>
                                <SelectItem value="Transferencia">Transferencia</SelectItem>
                                <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                <SelectItem value="Sinpe Movil">Sinpe Móvil</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Modo de Entrega</Label>
                        <Select
                            value={params.deliveryMode}
                            onValueChange={(val: DeliveryMode) => setParams({ ...params, deliveryMode: val })}
                        >
                            <SelectTrigger>
                                <div className="flex items-center gap-2">
                                    <Truck className="h-4 w-4" />
                                    <SelectValue placeholder="Seleccionar entrega" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Local">Cliente retira en local</SelectItem>
                                <SelectItem value="Domicilio">A domicilio</SelectItem>
                                <SelectItem value="Encomienda">Encomienda</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {params.deliveryMode === 'Domicilio' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Label htmlFor="distanceKm">Distancia (km)</Label>
                            <div className="relative">
                                <Input
                                    id="distanceKm"
                                    type="number"
                                    placeholder="0"
                                    className="pr-12"
                                    value={params.distanceKm === 0 ? '' : params.distanceKm}
                                    onChange={(e) => setParams({ ...params, distanceKm: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                />
                                <span className="absolute right-3 top-2.5 text-muted-foreground text-sm font-medium">km</span>
                            </div>
                            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1 font-medium italic">
                                <MapPin className="h-3 w-3" />
                                Favor confirmar la distancia usando Google Maps o Waze.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Percent className="h-5 w-5 text-primary" />
                        Opciones de Descuento
                    </h3>
                    <Badge variant="outline" className="bg-primary/5">
                        {calculationScenarios.scenarios.length} {calculationScenarios.scenarios.length === 1 ? 'Opción' : 'Opciones'}
                    </Badge>
                </div>

                {calculationScenarios.missingTransport && (
                    <Alert variant="destructive" className="animate-pulse">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertTitle>Costo de transporte no definido</AlertTitle>
                        <AlertDescription className="text-xs">
                            No se ha definido un costo por kilómetro en la configuración.
                            <strong> Contactar a Michael Sanchez para definir el costo.</strong>
                        </AlertDescription>
                    </Alert>
                )}

                {calculationScenarios.noRules && params.saleAmount > 0 && (
                    <div className="p-4 bg-muted/20 border border-dashed rounded-lg text-center space-y-2">
                        <p className="text-sm text-muted-foreground">No aplican reglas de descuento para esta venta.</p>
                        <p className="text-[10px] font-medium text-amber-600">Para casos especiales, consultar con Tatiana o Michael.</p>
                    </div>
                )}

                <div className="grid gap-4">
                    {calculationScenarios.scenarios.map((scenario, idx) => (
                        <Card key={idx} className={`relative overflow-hidden transition-all duration-300 ${scenario.isDefault ? 'border-dashed opacity-80' : 'border-2 border-primary/20 hover:border-primary/50 hover:shadow-lg'}`}>
                            {idx === 0 && !scenario.isDefault && (
                                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-2 py-1 font-bold uppercase tracking-tighter rounded-bl-lg">
                                    Recomendado
                                </div>
                            )}
                            <CardHeader className="pb-2 pt-4">
                                <CardTitle className="text-lg flex justify-between items-center capitalize">
                                    {scenario.ruleName}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pb-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Productos</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xl font-black text-primary">₡{scenario.totalDiscounted.toLocaleString()}</p>
                                            {!scenario.isDefault && <Badge className="bg-primary text-[10px] px-1.5 py-0 h-5 whitespace-nowrap">{scenario.maxDiscount}% en Productos</Badge>}
                                        </div>
                                        {scenario.maxDiscount > 0 && <p className="text-[10px] text-green-600 font-medium">Ahorras ₡{(params.saleAmount - scenario.totalDiscounted).toLocaleString()}</p>}
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Transporte</p>
                                        <p className={`text-xl font-black ${scenario.isFreeTransport ? 'text-green-600' : 'text-primary'}`}>
                                            {scenario.isFreeTransport ? 'GRATIS' : `₡${scenario.transportPrice.toLocaleString()}`}
                                        </p>
                                        <p className={`text-[10px] font-medium ${scenario.isFreeTransport ? 'text-green-600' : 'text-muted-foreground'}`}>{scenario.transportBenefitText}</p>
                                    </div>
                                </div>
                                <div className="pt-2 border-t flex justify-between items-center">
                                    <span className="text-xs font-medium text-muted-foreground">Inversión Total Estimada:</span>
                                    <span className="text-lg font-bold">₡{(scenario.totalDiscounted + scenario.transportPrice).toLocaleString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Alert className="bg-amber-50 border-amber-200">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 font-bold">Nota para Vendedores</AlertTitle>
                    <AlertDescription className="text-amber-700 text-xs">
                        Si desean otorgar condiciones mejores a las listadas, deben contactar a la gerencia (Michael o Tatiana).
                    </AlertDescription>
                </Alert>
            </div>
        </div>
    );
}
