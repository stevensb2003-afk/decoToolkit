
import { Timestamp } from "firebase/firestore";

export interface DiscountRule {
    id: string;
    name: string;

    // Amount condition
    amountCondition: 'min' | 'max' | 'between';
    minAmount: number;
    maxAmount?: number;

    // Distance condition
    distanceCondition: 'min' | 'max' | 'between';
    minDistance: number;
    maxDistance?: number;

    discountPercent: number; // For sale amount
    transportBenefitType: 'none' | 'free' | 'fixed' | 'percentage';
    transportBenefitValue?: number; // Fixed price, or % discount on transport
    paymentMethods?: (PaymentMethod | 'all')[];
    isActive: boolean;
    createdAt?: Timestamp | Date;
    updatedAt?: Timestamp | Date;
}

export interface TransportRange {
    id: string;
    minKm: number;
    maxKm: number;
    price: number;
    createdAt?: Timestamp | Date;
    updatedAt?: Timestamp | Date;
}

export interface PricingSettings {
    id: string;
    costPerKm: number;
    delegatedAdmins: string[]; // List of user emails
    lastUpdatedBy: string;
    updatedAt: Timestamp | Date;
}

export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Sinpe Movil';
export type DeliveryMode = 'Local' | 'Domicilio' | 'Encomienda';

export interface SaleCalculationParams {
    saleAmount: number;
    paymentMethod: PaymentMethod;
    deliveryMode: DeliveryMode;
    distanceKm?: number;
}
