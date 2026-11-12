namespace WebPos.Application.Services;

public sealed record InboundLineCalculationResult(
    decimal DiscountAmount4,
    decimal DependentCostAmount4,
    decimal PurchasePriceExclVat4,
    decimal WholesalePriceExclVat4,
    decimal RetailPriceInclVat2,
    decimal LineTotalPurchase4,
    decimal LineTotalRetail2,
    decimal LineVatAmount2);

public static class CalculationMath
{
    private const decimal Hundred = 100m;

    public static decimal Round4(decimal value) =>
        decimal.Round(value, 4, MidpointRounding.AwayFromZero);

    public static decimal Round2(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    public static decimal CalculateDiscountAmount4(decimal invoicePriceExclVat4, decimal discountPct) =>
        Round4(invoicePriceExclVat4 * (discountPct / Hundred));

    public static decimal CalculateDependentCostAmount4(decimal basePriceExclVat4, decimal dependentCostPct) =>
        Round4(basePriceExclVat4 * (dependentCostPct / Hundred));

    public static decimal CalculatePurchasePriceExclVat4(
        decimal invoicePriceExclVat4,
        decimal discountPct,
        decimal dependentCostPct)
    {
        var discountAmount4 = CalculateDiscountAmount4(invoicePriceExclVat4, discountPct);
        var discountedPrice4 = Round4(invoicePriceExclVat4 - discountAmount4);
        var dependentCost4 = CalculateDependentCostAmount4(discountedPrice4, dependentCostPct);
        return Round4(discountedPrice4 + dependentCost4);
    }

    public static decimal CalculateWholesalePriceExclVat4(decimal purchasePriceExclVat4, decimal marginPct) =>
        Round4(purchasePriceExclVat4 * (1m + (marginPct / Hundred)));

    public static decimal CalculateMarginPctFromWholesale(decimal purchasePriceExclVat4, decimal wholesalePriceExclVat4)
    {
        if (purchasePriceExclVat4 <= 0m)
        {
            return 0m;
        }

        return Round4(((wholesalePriceExclVat4 - purchasePriceExclVat4) / purchasePriceExclVat4) * Hundred);
    }

    public static decimal CalculateRetailPriceInclVat2(decimal wholesalePriceExclVat4, decimal vatRatePercent) =>
        Round2(wholesalePriceExclVat4 * (1m + (vatRatePercent / Hundred)));

    public static decimal CalculateWholesaleFromRetail4(decimal retailPriceInclVat2, decimal vatRatePercent)
    {
        var divisor = 1m + (vatRatePercent / Hundred);
        return divisor <= 0m ? Round4(retailPriceInclVat2) : Round4(retailPriceInclVat2 / divisor);
    }

    public static decimal CalculateVatFromGross2(decimal grossAmount2, decimal vatRatePercent)
    {
        if (vatRatePercent <= 0m)
        {
            return 0m;
        }

        return Round2(grossAmount2 * vatRatePercent / (Hundred + vatRatePercent));
    }

    public static InboundLineCalculationResult CalculateInboundLine(
        decimal quantity,
        decimal invoicePriceExclVat4,
        decimal discountPct,
        decimal dependentCostPct,
        decimal marginPct,
        decimal vatRatePercent)
    {
        var discountAmount4 = CalculateDiscountAmount4(invoicePriceExclVat4, discountPct);
        var discountedPrice4 = Round4(invoicePriceExclVat4 - discountAmount4);
        var dependentCostAmount4 = CalculateDependentCostAmount4(discountedPrice4, dependentCostPct);
        var purchasePriceExclVat4 = Round4(discountedPrice4 + dependentCostAmount4);
        var wholesalePriceExclVat4 = CalculateWholesalePriceExclVat4(purchasePriceExclVat4, marginPct);
        var retailPriceInclVat2 = CalculateRetailPriceInclVat2(wholesalePriceExclVat4, vatRatePercent);

        var lineTotalPurchase4 = Round4(purchasePriceExclVat4 * quantity);
        var lineTotalRetail2 = Round2(retailPriceInclVat2 * quantity);
        var lineVatAmount2 = CalculateVatFromGross2(lineTotalRetail2, vatRatePercent);

        return new InboundLineCalculationResult(
            DiscountAmount4: discountAmount4,
            DependentCostAmount4: dependentCostAmount4,
            PurchasePriceExclVat4: purchasePriceExclVat4,
            WholesalePriceExclVat4: wholesalePriceExclVat4,
            RetailPriceInclVat2: retailPriceInclVat2,
            LineTotalPurchase4: lineTotalPurchase4,
            LineTotalRetail2: lineTotalRetail2,
            LineVatAmount2: lineVatAmount2);
    }
}
