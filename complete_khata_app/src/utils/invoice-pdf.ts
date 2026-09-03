import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { capitalizeFirst, formatCurrency, formatDate } from "@/utils/formatters";

export interface InvoiceItemPdfRow {
  id: string;
  description: string;
  quantity: number;
  unit_type: string;
  weight_per_unit: number | null;
  total_weight: number | null;
  unit_price: number;
  total_price: number;
}

export interface InvoicePdfDetails {
  documentTypeLabel: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  partyLabel: string;
  partyName: string;
  saleOrPurchaseTypeLabel?: string;
  notes?: string | null;
  subtotal: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  items: InvoiceItemPdfRow[];
  payments?: { payment_date: string; amount: number; notes: string | null }[];
  headerFillColor?: [number, number, number];
  headerTextColor?: [number, number, number];
  balanceDueFillColor?: [number, number, number];
  balanceDueTextColor?: [number, number, number];
}

const YELLOW: [number, number, number] = [250, 204, 21]; // tailwind yellow-400
const BLACK: [number, number, number] = [0, 0, 0];
type AutoTableDocument = jsPDF & { lastAutoTable?: { finalY?: number } };

function getBagCountAndRemainder(totalWeight: number, bagWeight: number) {
  if (!bagWeight || totalWeight <= 0) {
    return { bagCount: 0, remainder: roundToThree(totalWeight) };
  }

  const bagCount = Math.floor(totalWeight / bagWeight);
  const remainder = roundToThree(totalWeight - bagCount * bagWeight);
  return { bagCount, remainder };
}

function roundToThree(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function formatSoldBreakdown(totalWeight: number, bagWeight: number | null) {
  if (!bagWeight || bagWeight <= 0) {
    return `${roundToThree(totalWeight)}`;
  }

  const { bagCount, remainder } = getBagCountAndRemainder(totalWeight, bagWeight);
  if (bagCount <= 0) {
    return `${roundToThree(totalWeight)} kg`;
  }

  if (remainder <= 0.001) {
    return `${bagCount} bag${bagCount === 1 ? "" : "s"}`;
  }

  return `${bagCount} bag${bagCount === 1 ? "" : "s"} + ${remainder} kg`;
}

export function downloadInvoicePdf(details: InvoicePdfDetails) {
  const doc = new jsPDF({ orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  let cursorY = 20;

  // Header: party details on the left and invoice details on the right.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(details.partyLabel === "Customer" ? "BILL TO" : details.partyLabel.toUpperCase(), margin, cursorY);

  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(details.partyName, margin, cursorY + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(details.documentTypeLabel, pageWidth - margin, cursorY, { align: "right" });

  cursorY += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Invoice #: ${details.invoiceNumber}`, pageWidth - margin, cursorY, { align: "right" });

  doc.setTextColor(33, 37, 41);
  doc.text(`Date: ${formatDate(details.invoiceDate)}`, pageWidth - margin, cursorY + 5, { align: "right" });
  doc.text(`Due Date: ${details.dueDate ? formatDate(details.dueDate) : "N/A"}`, pageWidth - margin, cursorY + 10, { align: "right" });
  doc.text(`Type: ${capitalizeFirst(details.saleOrPurchaseTypeLabel ?? "")}`, pageWidth - margin, cursorY + 15, { align: "right" });

  cursorY += 23;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);

  cursorY += 8;

  // Items grid — mirrors the on-screen table: Qty, Description, Unit, Kg/Bag, Weight, Price, Amount
  const itemRows = details.items.map((item) => [
    item.unit_type === "kg"
      ? `${roundToThree(item.total_weight ?? item.quantity)}`
      : `${item.total_weight ?? item.quantity}`,
    item.description,
    item.unit_type === "bag" ? "bags" : item.unit_type,
    item.weight_per_unit != null ? `${item.weight_per_unit} kg` : "-",
    item.unit_type === "kg"
      ? `${roundToThree(item.total_weight ?? item.quantity)} kg`
      : (item.total_weight != null ? `${item.total_weight} kg` : `${item.quantity} kg`),
    formatCurrency(item.unit_price),
    formatCurrency(item.total_price),
  ]);

  // Totals appended as merged rows in the SAME table, same as the on-screen version
  const balanceDueFill = details.balanceDueFillColor ?? YELLOW;
  const balanceDueText = details.balanceDueTextColor ?? BLACK;
  const totalsRows = [
    [
      { content: "Subtotal", colSpan: 6, styles: { halign: "right" as const, fontStyle: "bold" as const } },
      { content: formatCurrency(details.subtotal), styles: { halign: "right" as const } },
    ],
    [
      { content: "Discount", colSpan: 6, styles: { halign: "right" as const, fontStyle: "bold" as const } },
      { content: `- ${formatCurrency(details.discount)}`, styles: { halign: "right" as const } },
    ],
    [
      { content: "Total", colSpan: 6, styles: { halign: "right" as const, fontStyle: "bold" as const } },
      { content: formatCurrency(details.totalAmount), styles: { halign: "right" as const, fontStyle: "bold" as const } },
    ],
    [
      { content: "Paid", colSpan: 6, styles: { halign: "right" as const, fontStyle: "bold" as const } },
      { content: formatCurrency(details.amountPaid), styles: { halign: "right" as const } },
    ],
    [
      {
        content: "Balance Due",
        colSpan: 6,
        styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: balanceDueFill, textColor: balanceDueText },
      },
      {
        content: formatCurrency(details.balanceDue),
        styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: balanceDueFill, textColor: balanceDueText },
      },
    ],
  ];

  // Column widths sized to fit each header label on one line (sums to ~178mm usable width)
  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    head: [["Qty", "Description", "Unit", "Kg/Bag", "Weight", "Price", "Amount"]],
    body: [...itemRows, ...totalsRows],
    styles: { fontSize: 9, cellPadding: 3.5, lineColor: BLACK, lineWidth: 0.3, overflow: "linebreak" },
    headStyles: {
      fillColor: details.headerFillColor ?? YELLOW,
      textColor: details.headerTextColor ?? BLACK,
      halign: "center",
      fontStyle: "bold",
      fontSize: 9,
      lineColor: BLACK,
      lineWidth: 0.3,
      cellPadding: { top: 4, bottom: 4, left: 2, right: 2 },
    },
    columnStyles: {
      0: { halign: "right", cellWidth: 18 },
      1: { halign: "left", cellWidth: 62 },
      2: { halign: "center", cellWidth: 14 },
      3: { halign: "right", cellWidth: 18 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 24 },
    },
    bodyStyles: { textColor: 20 },
    theme: "grid",
  });

  const lastAutoTable = (doc as AutoTableDocument).lastAutoTable;
  cursorY = (lastAutoTable?.finalY ?? cursorY + 100) + 10;

  // Payment history — kept as its own table below, same as the on-screen "Payment History" card.
  // Always render this heading (even with no payments yet) so it's never silently dropped from the PDF.
  const reserveForPaymentSection = 40;
  if (cursorY > pageHeight - reserveForPaymentSection) {
    doc.addPage();
    cursorY = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Payment History", margin, cursorY);
  cursorY += 5;

  if (details.payments && details.payments.length > 0) {
    const paymentRows = details.payments.map((p) => [
      formatDate(p.payment_date),
      formatCurrency(p.amount),
      p.notes || "-",
    ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [["Date", "Amount Received", "Notes"]],
      body: paymentRows,
      styles: { fontSize: 9, cellPadding: 3, lineColor: BLACK, lineWidth: 0.3 },
      headStyles: {
        fillColor: [229, 231, 235],
        textColor: BLACK,
        halign: "left",
        fontStyle: "bold",
        lineColor: BLACK,
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 40, halign: "right" },
        2: { cellWidth: pageWidth - margin * 2 - 75 },
      },
      bodyStyles: { textColor: 20 },
      theme: "grid",
    });

    const lastTable = (doc as AutoTableDocument).lastAutoTable;
    cursorY = (lastTable?.finalY ?? cursorY + 40) + 10;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("No payments recorded yet.", margin, cursorY + 4);
    cursorY += 14;
  }

  if (details.notes) {
    if (cursorY > pageHeight - 30) {
      doc.addPage();
      cursorY = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("NOTES", margin, cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    const notesLines = doc.splitTextToSize(details.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, cursorY + 6);
    cursorY += 6 + notesLines.length * 5;
  }

  if (cursorY > pageHeight - 20) {
    doc.addPage();
    cursorY = 20;
  }
  cursorY += 10;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text("Thank you for your business.", pageWidth / 2, cursorY + 6, { align: "center" });

  const partySlug = details.partyName.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
  const typeSlug = details.documentTypeLabel.toLowerCase().replace(/\s+/g, "_");
  const fileName = `${typeSlug}_${partySlug}_${details.invoiceNumber}.pdf`;
  doc.save(fileName);
}
