package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.model.CfdiTimbrado;
import com.ferreteria.PuntoDeVenta.model.Empresa;
import com.ferreteria.PuntoDeVenta.repository.CfdiTimbradoRepository;
import com.ferreteria.PuntoDeVenta.repository.EmpresaRepository;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.*;
import com.itextpdf.layout.properties.Property;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.layout.properties.VerticalAlignment;
import com.itextpdf.layout.splitting.BreakAllSplitCharacters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PdfCfdiService {

    private final CfdiTimbradoRepository cfdiRepo;
    private final EmpresaRepository empresaRepo;

    // Colores — casi todo negro como el PDF de FEL.
    // El azul SOLO se usa en los links del pie de página.
    private static final DeviceRgb NEGRO      = new DeviceRgb(0,   0,   0);
    private static final DeviceRgb AZUL_FEL   = new DeviceRgb(0,   102, 204); // links pie
    private static final DeviceRgb GRIS_TABLA = new DeviceRgb(210, 210, 210);
    private static final DeviceRgb GRIS_HDR   = new DeviceRgb(235, 235, 235); // fondo fila alterna
    private static final DeviceRgb BLANCO     = new DeviceRgb(255, 255, 255);

    public String generarPdfBase64(String uuid) {
        CfdiTimbrado cfdi = cfdiRepo.findByUuid(uuid)
                .orElseThrow(() -> new RuntimeException("CFDI no encontrado: " + uuid));
        if (cfdi.getXmlTimbrado() == null || cfdi.getXmlTimbrado().isBlank())
            throw new RuntimeException("Este CFDI no tiene XML almacenado.");
        try {
            return Base64.getEncoder().encodeToString(generarPdf(cfdi));
        } catch (Exception e) {
            log.error("[PDF] Error UUID {}", uuid, e);
            throw new RuntimeException("Error al generar PDF: " + e.getMessage());
        }
    }

    private byte[] generarPdf(CfdiTimbrado cfdi) throws Exception {
        // ── Leer datos de la empresa emisora desde BD ───────────────
        Empresa empresa = empresaRepo.findAll().stream().findFirst().orElse(null);
        String emDirCompleta = "";
        String emTel = "";
        if (empresa != null) {
            StringBuilder dir = new StringBuilder();
            if (empresa.getDireccion()!=null&&!empresa.getDireccion().isBlank())
                dir.append(empresa.getDireccion());
            if (empresa.getColonia()!=null&&!empresa.getColonia().isBlank())
                dir.append(", ").append(empresa.getColonia());
            if (empresa.getCodigoPostal()!=null&&!empresa.getCodigoPostal().isBlank())
                dir.append(", ").append(empresa.getCodigoPostal());
            if (empresa.getMunicipio()!=null&&!empresa.getMunicipio().isBlank())
                dir.append(", ").append(empresa.getMunicipio());
            if (empresa.getEstado()!=null&&!empresa.getEstado().isBlank())
                dir.append(", ").append(empresa.getEstado());
            dir.append(", México");
            emDirCompleta = dir.toString();
            if (empresa.getTelefono()!=null&&!empresa.getTelefono().isBlank())
                emTel = "Tel. " + empresa.getTelefono();
        }

        // ── Leer domicilio del cliente desde la relación sale→customer ──
        String recDirCompleta = "";
        try {
            if (cfdi.getSale()!=null && cfdi.getSale().getCustomer()!=null) {
                var cust = cfdi.getSale().getCustomer();
                StringBuilder cd = new StringBuilder();
                if (cust.getAddress()!=null&&!cust.getAddress().isBlank())
                    cd.append(cust.getAddress());
                if (cust.getCodigoPostal()!=null&&!cust.getCodigoPostal().isBlank())
                    cd.append(", ").append(cust.getCodigoPostal());
                if (cust.getCity()!=null&&!cust.getCity().isBlank())
                    cd.append(", ").append(cust.getCity());
                cd.append(", México");
                recDirCompleta = cd.toString();
            }
        } catch (Exception ignored) {}

        // ── Parsear XML ─────────────────────────────────────────────
        String xmlRaw = cfdi.getXmlTimbrado();
        if (xmlRaw.contains("&lt;"))
            xmlRaw = xmlRaw.replace("&lt;","<").replace("&gt;",">")
                    .replace("&amp;","&").replace("&quot;","\"").replace("&#39;","'");
        int si = xmlRaw.indexOf("<?xml");
        if (si < 0) si = xmlRaw.indexOf("<cfdi:Comprobante");
        if (si > 0) xmlRaw = xmlRaw.substring(si);

        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        org.w3c.dom.Document xml;
        try {
            xml = dbf.newDocumentBuilder().parse(new ByteArrayInputStream(xmlRaw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            dbf = DocumentBuilderFactory.newInstance(); dbf.setNamespaceAware(false);
            xml = dbf.newDocumentBuilder().parse(new ByteArrayInputStream(xmlRaw.getBytes(StandardCharsets.UTF_8)));
        }
        xml.getDocumentElement().normalize();

        Element comp = xml.getDocumentElement();
        Element emis = fe(xml, "Emisor");
        Element recp = fe(xml, "Receptor");
        Element tfd  = fe(xml, "TimbreFiscalDigital");
        NodeList cNL = xml.getElementsByTagNameNS("*","Concepto");
        if (cNL.getLength()==0) cNL = xml.getElementsByTagName("cfdi:Concepto");
        if (cNL.getLength()==0) cNL = xml.getElementsByTagName("Concepto");

        // Datos
        String folio  = aF(comp,"Folio",           xmlRaw,"Folio");
        String serie  = aF(comp,"Serie",            xmlRaw,"Serie");
        String fecha  = aF(comp,"Fecha",            xmlRaw,"Fecha").replace("T"," ");
        String fpago  = aF(comp,"FormaPago",        xmlRaw,"FormaPago");
        String mpago  = aF(comp,"MetodoPago",       xmlRaw,"MetodoPago");
        String moneda = aF(comp,"Moneda",           xmlRaw,"Moneda");
        String lugar  = aF(comp,"LugarExpedicion",  xmlRaw,"LugarExpedicion");
        String subS   = aF(comp,"SubTotal",         xmlRaw,"SubTotal");
        String totS   = aF(comp,"Total",            xmlRaw,"Total");
        String noCert = aF(comp,"NoCertificado",    xmlRaw,"NoCertificado");
        String ver    = aF(comp,"Version",          xmlRaw,"Version");
        String expor  = aF(comp,"Exportacion",      xmlRaw,"Exportacion");
        String tipoC  = aF(comp,"TipoDeComprobante",xmlRaw,"TipoDeComprobante");

        String emRfc   = emis!=null?a(emis,"Rfc")          :rx(xmlRaw,"Emisor[^>]*Rfc=\"([^\"]+)\"");
        String emNom   = emis!=null?a(emis,"Nombre")       :rx(xmlRaw,"Emisor[^>]*Nombre=\"([^\"]+)\"");
        String emReg   = emis!=null?a(emis,"RegimenFiscal"):"";

        String recRfc  = recp!=null?a(recp,"Rfc")                    :cfdi.getRfcReceptor();
        String recNom  = recp!=null?a(recp,"Nombre")                 :cfdi.getNombreReceptor();
        String recCp   = recp!=null?a(recp,"DomicilioFiscalReceptor"):"";
        String recReg  = recp!=null?a(recp,"RegimenFiscalReceptor")  :"";
        String recUso  = recp!=null?a(recp,"UsoCFDI")                :"";
        if (recNom==null||recNom.isBlank()) recNom=cfdi.getNombreReceptor()!=null?cfdi.getNombreReceptor():"PUBLICO EN GENERAL";
        if (recRfc==null||recRfc.isBlank()) recRfc=cfdi.getRfcReceptor()!=null?cfdi.getRfcReceptor():"XAXX010101000";

        String uuid2     = tfd!=null?a(tfd,"UUID")             :cfdi.getUuid();
        String fechaTfd  = tfd!=null?a(tfd,"FechaTimbrado")    :"";
        String rfcPac    = tfd!=null?a(tfd,"RfcProvCertif")    :"";
        String noCertSat = tfd!=null?a(tfd,"NoCertificadoSAT") :"";
        String selloSat  = tfd!=null?a(tfd,"SelloSAT")         :"";
        String selloCfd  = tfd!=null?a(tfd,"SelloCFD")         :"";
        if (uuid2==null||uuid2.isBlank()) uuid2=cfdi.getUuid();
        String cadOrig = "||"+(ver.isBlank()?"4.0":ver)+"|"+uuid2+"|"+fechaTfd+"|"+selloCfd+"|"+noCertSat+"||";

        BigDecimal iva = BigDecimal.ZERO;
        try { iva=new BigDecimal(totS.replace(",","")).subtract(new BigDecimal(subS.replace(",",""))); }
        catch(Exception ig){}

        // ── Conceptos COMPACTOS: una sola línea por producto ────────
        // [cantidad, unidad, claveProdServ, descripción, precioUnit, importe]
        List<String[]> concs = new ArrayList<>();
        String tasaGlobal = "0.160000";
        for (int i=0;i<cNL.getLength();i++) {
            Element c = (Element)cNL.item(i);

            // Solo tomamos la tasa para mostrarla en los totales
            NodeList trs = c.getElementsByTagNameNS("*","Traslado");
            if (trs.getLength()==0) trs=c.getElementsByTagName("cfdi:Traslado");
            for (int t=0;t<trs.getLength();t++) {
                String tasa=a((Element)trs.item(t),"TasaOCuota");
                if(!tasa.isBlank()) tasaGlobal=tasa;
            }

            String claveUni   = a(c,"ClaveUnidad");
            String unidadAttr = a(c,"Unidad");
            BigDecimal pu=bigD(a(c,"ValorUnitario")), imp2=bigD(a(c,"Importe"));

            concs.add(new String[]{
                    fmtCant(a(c,"Cantidad")),
                    claveUni + " - " + nombreUnidad(claveUni, unidadAttr),
                    a(c,"ClaveProdServ"),
                    a(c,"Descripcion"),
                    "$ "+fmtM(pu.toPlainString()),
                    "$ "+fmtM(imp2.toPlainString())
            });
        }

        String enLetra  = numeroALetras(totS);
        String folioNum = (serie.isBlank()?"":serie+" ")+folio;

        // ── PDF ────────────────────────────────────────────────────
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfDocument pdfDoc = new PdfDocument(new PdfWriter(baos));
        Document doc = new Document(pdfDoc, PageSize.LETTER);
        doc.setMargins(20, 20, 20, 20);

        // ════════════════════════════════════════════════════════════
        // CABECERA — 3 zonas: [logo izq] [emisor+cliente centro] [CFDI der]
        // Todo en NEGRO como el PDF original de FEL
        // ════════════════════════════════════════════════════════════

        // Contenido Emisor
        Table tEmis = new Table(UnitValue.createPercentArray(new float[]{100}))
                .setWidth(UnitValue.createPercentValue(100));
        Cell cEmis = new Cell().setBorder(Border.NO_BORDER)
                .setPaddingTop(4).setPaddingBottom(2).setPaddingLeft(8).setPaddingRight(8)
                .setTextAlignment(TextAlignment.CENTER);
        cEmis.add(p(emNom,10,true).setTextAlignment(TextAlignment.CENTER).setMarginBottom(1));
        cEmis.add(p(emRfc,8,false).setTextAlignment(TextAlignment.CENTER).setMarginBottom(1));
        cEmis.add(p("RÉGIMEN FISCAL: "+emReg+" - "+catalogRegimen(emReg),7f,false)
                .setTextAlignment(TextAlignment.CENTER));
        if (!emDirCompleta.isBlank())
            cEmis.add(p(emDirCompleta,6.5f,false).setTextAlignment(TextAlignment.CENTER));
        if (!emTel.isBlank())
            cEmis.add(p(emTel,6.5f,false).setTextAlignment(TextAlignment.CENTER));
        tEmis.addCell(cEmis);

        // Contenido Cliente
        Table tCli = new Table(UnitValue.createPercentArray(new float[]{100}))
                .setWidth(UnitValue.createPercentValue(100));
        Cell cCli = new Cell().setBorder(Border.NO_BORDER)
                .setPaddingTop(2).setPaddingBottom(4).setPaddingLeft(8).setPaddingRight(8)
                .setTextAlignment(TextAlignment.CENTER);
        cCli.add(p("CLIENTE",11,true).setTextAlignment(TextAlignment.CENTER).setMarginBottom(2));
        cCli.add(p(recNom,9,true).setTextAlignment(TextAlignment.CENTER).setMarginBottom(1));
        cCli.add(p(recRfc,8,false).setTextAlignment(TextAlignment.CENTER).setMarginBottom(1));
        cCli.add(p("USO CFDI: "+recUso+" - "+catalogUsoCfdi(recUso)+".",7f,false)
                .setTextAlignment(TextAlignment.CENTER));
        cCli.add(p("DOMICILIO FISCAL: "+recCp,7f,false).setTextAlignment(TextAlignment.CENTER));
        cCli.add(p("REGIMEN FISCAL: "+recReg+" - "+catalogRegimen(recReg),7f,false)
                .setTextAlignment(TextAlignment.CENTER));
        if (!recDirCompleta.isBlank())
            cCli.add(p(recDirCompleta,6.5f,false).setTextAlignment(TextAlignment.CENTER));
        tCli.addCell(cCli);

        // Tabla principal: [logo rowspan=2] [emisor / cliente] [cfdi rowspan=2]
        // Columnas laterales SIMÉTRICAS (32.5 / 35 / 32.5) para que el bloque
        // central de emisor/cliente quede centrado respecto a la hoja.
        Table hdr = new Table(UnitValue.createPercentArray(new float[]{32.5f,35,32.5f}))
                .setWidth(UnitValue.createPercentValue(100));

        // Col 1 — Logo (espacio reservado, sin borde)
        hdr.addCell(new Cell(2,1)
                .setBorder(Border.NO_BORDER)
                .setPadding(8)
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .add(p("",8,false)));

        // Col 2 fila 1 — Emisor
        hdr.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(0).add(tEmis));

        // Col 3 — Datos CFDI (labels bold, valores normales — todo negro)
        Cell hDer = new Cell(2,1).setBorder(Border.NO_BORDER).setPadding(4)
                .setVerticalAlignment(VerticalAlignment.TOP);
        hDer.add(p("Factura "+folioNum,13,true).setTextAlignment(TextAlignment.RIGHT).setMarginBottom(3));
        hDer.add(pLabel("FOLIO FISCAL (UUID)"));
        hDer.add(pVal(uuid2));
        hDer.add(pLabel("NO. DE SERIE DEL CERTIFICADO DEL SAT"));
        hDer.add(pVal(noCertSat));
        hDer.add(pLabel("NO. DE SERIE DEL CERTIFICADO DEL EMISOR"));
        hDer.add(pVal(noCert));
        hDer.add(pLabel("FECHA Y HORA DE CERTIFICACIÓN"));
        hDer.add(pVal(fechaTfd.replace("T"," ")));
        hDer.add(pLabel("RFC PROVEEDOR DE CERTIFICACIÓN"));
        hDer.add(pVal(rfcPac));
        hDer.add(pLabel("FECHA Y HORA DE EMISIÓN DE CFDI"));
        hDer.add(pVal(fecha));
        hDer.add(pLabel("LUGAR DE EXPEDICIÓN"));
        hDer.add(pVal(lugar));
        hdr.addCell(hDer);

        // Col 2 fila 2 — Cliente
        hdr.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(0).add(tCli));

        doc.add(hdr.setMarginBottom(6));

        // ════════════════════════════════════════════════════════════
        // TABLA DE CONCEPTOS — COMPACTA (1 línea por producto)
        // El detalle de impuestos NO se repite por concepto;
        // el IVA se muestra en los totales (estilo Magno Centro)
        // ════════════════════════════════════════════════════════════
        Table tituloConc = new Table(UnitValue.createPercentArray(new float[]{100}))
                .setWidth(UnitValue.createPercentValue(100));
        tituloConc.addCell(new Cell()
                .setBackgroundColor(NEGRO).setBorder(Border.NO_BORDER).setPadding(2)
                .add(p("CONCEPTOS",8,true).setFontColor(BLANCO).setTextAlignment(TextAlignment.CENTER)));
        doc.add(tituloConc.setMarginBottom(0));

        // Columnas: # | Cant | Unidad | Clave SAT | Descripción | P.Unit | Importe
        float[] colPcts = {5, 7, 9, 11, 44, 12, 12};
        Table cTbl = new Table(UnitValue.createPercentArray(colPcts))
                .setWidth(UnitValue.createPercentValue(100));

        String[] cH = {"#","Cant.","Unidad","Clave SAT","Descripción","P. Unitario","Importe"};
        for (String h : cH)
            cTbl.addHeaderCell(new Cell()
                    .setBackgroundColor(NEGRO)
                    .setBorder(new SolidBorder(BLANCO, 0.5f))
                    .setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(3).setPaddingRight(3)
                    .add(p(h,7f,true).setFontColor(BLANCO).setTextAlignment(TextAlignment.CENTER)));

        // Filas compactas: padding mínimo, fuente 7, fondo alterno gris muy claro
        SolidBorder bCelda = new SolidBorder(GRIS_TABLA, 0.4f);
        TextAlignment[] al = {
                TextAlignment.CENTER,  // #
                TextAlignment.RIGHT,   // Cant
                TextAlignment.CENTER,  // Unidad
                TextAlignment.CENTER,  // Clave SAT
                TextAlignment.LEFT,    // Descripción
                TextAlignment.RIGHT,   // P.Unit
                TextAlignment.RIGHT    // Importe
        };
        boolean alt = false;
        int partida = 1;
        for (String[] con : concs) {
            DeviceRgb bg = alt ? GRIS_HDR : BLANCO;
            alt = !alt;
            String[] fila = {
                    String.valueOf(partida++),
                    con[0], con[1], con[2], con[3], con[4], con[5]
            };
            for (int i=0;i<fila.length;i++) {
                cTbl.addCell(new Cell()
                        .setBackgroundColor(bg)
                        .setBorder(bCelda)
                        .setPaddingTop(1.5f).setPaddingBottom(1.5f)
                        .setPaddingLeft(3).setPaddingRight(3)
                        .add(p(fila[i],7f,false).setFontColor(NEGRO)
                                .setMultipliedLeading(1.05f)
                                .setTextAlignment(al[i])));
            }
        }
        if (concs.isEmpty())
            cTbl.addCell(new Cell(1,7).setBorder(bCelda).setPadding(8)
                    .add(p("Sin conceptos en XML.",8,false).setFontColor(NEGRO)));
        doc.add(cTbl.setMarginBottom(8));

        // ════════════════════════════════════════════════════════════
        // PIE — Datos izquierda | Totales derecha
        // ════════════════════════════════════════════════════════════
        Table pie = new Table(UnitValue.createPercentArray(new float[]{60,40}))
                .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(8);

        Cell piIzq = new Cell().setBorder(Border.NO_BORDER).setPadding(0).setPaddingRight(8);

        // "IMPORTE CON LETRA   [valor]" en la misma fila
        Table letraRow = new Table(UnitValue.createPercentArray(new float[]{32,68}))
                .setWidth(UnitValue.createPercentValue(100));
        letraRow.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(1)
                .add(p("IMPORTE CON LETRA",6.5f,true).setFontColor(NEGRO)));
        letraRow.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(1)
                .add(p(enLetra,6.5f,false).setFontColor(NEGRO)));
        piIzq.add(letraRow.setMarginBottom(3));

        // Datos en 2 columnas — label bold | valor
        Table datosIzq = new Table(UnitValue.createPercentArray(new float[]{38,62}))
                .setWidth(UnitValue.createPercentValue(100));
        String[][] datos = {
                {"TIPO DE COMPROBANTE", catTipoComprobante(tipoC)},
                {"FORMA DE PAGO",       catFPago(fpago)},
                {"MÉTODO DE PAGO",      catMPago(mpago)},
                {"MONEDA",              catMoneda(moneda)},
                {"VERSION",             ver.isBlank()?"4.0":ver},
                {"EXPORTACION",         expor.equals("01")?"01 - No aplica":expor}
        };
        for (String[] d : datos) {
            datosIzq.addCell(new Cell().setBorder(Border.NO_BORDER).setPaddingTop(0.5f)
                    .setPaddingBottom(0.5f).setPaddingLeft(1).setPaddingRight(1)
                    .add(p(d[0],6.5f,true).setFontColor(NEGRO)));
            datosIzq.addCell(new Cell().setBorder(Border.NO_BORDER).setPaddingTop(0.5f)
                    .setPaddingBottom(0.5f).setPaddingLeft(1).setPaddingRight(1)
                    .add(p(d[1],6.5f,false).setFontColor(NEGRO)));
        }
        piIzq.add(datosIzq);
        pie.addCell(piIzq);

        // Derecha — SUBTOTAL / TRASLADO IVA / TOTAL
        Cell piDer = new Cell().setBorder(Border.NO_BORDER).setPadding(0)
                .setVerticalAlignment(VerticalAlignment.TOP);
        Table tots = new Table(UnitValue.createPercentArray(new float[]{58,42}))
                .setWidth(UnitValue.createPercentValue(100));

        tots.addCell(new Cell().setBorder(Border.NO_BORDER).setPaddingTop(0.5f).setPaddingBottom(0.5f)
                .add(p("SUBTOTAL",6.5f,true).setFontColor(NEGRO).setTextAlignment(TextAlignment.RIGHT)));
        tots.addCell(new Cell().setBorder(Border.NO_BORDER).setPaddingTop(0.5f).setPaddingBottom(0.5f)
                .add(p("$ "+fmtM(subS),6.5f,false).setFontColor(NEGRO).setTextAlignment(TextAlignment.RIGHT)));

        tots.addCell(new Cell().setBorder(Border.NO_BORDER).setPaddingTop(0.5f).setPaddingBottom(0.5f)
                .add(p("TRASLADO IVA TASA "+tasaGlobal,6.5f,true).setFontColor(NEGRO).setTextAlignment(TextAlignment.RIGHT)));
        tots.addCell(new Cell().setBorder(Border.NO_BORDER).setPaddingTop(0.5f).setPaddingBottom(0.5f)
                .add(p("$ "+fmtM(iva.toPlainString()),6.5f,false).setFontColor(NEGRO).setTextAlignment(TextAlignment.RIGHT)));

        tots.addCell(new Cell().setBorder(Border.NO_BORDER).setPaddingTop(0.5f).setPaddingBottom(0.5f)
                .add(p("TOTAL",6.5f,true).setFontColor(NEGRO).setTextAlignment(TextAlignment.RIGHT)));
        tots.addCell(new Cell().setBorder(Border.NO_BORDER).setPaddingTop(0.5f).setPaddingBottom(0.5f)
                .add(p("$ "+fmtM(totS),6.5f,true).setFontColor(NEGRO).setTextAlignment(TextAlignment.RIGHT)));

        piDer.add(tots);
        pie.addCell(piDer);
        doc.add(pie.setMarginBottom(8));

        // ════════════════════════════════════════════════════════════
        // SELLOS + QR — labels bold, sellos en micro (todo negro)
        // ════════════════════════════════════════════════════════════
        Table qrSel = new Table(UnitValue.createPercentArray(new float[]{18,82}))
                .setWidth(UnitValue.createPercentValue(100));

        Cell cQr = new Cell().setBorder(Border.NO_BORDER).setPadding(4)
                .setVerticalAlignment(VerticalAlignment.TOP);
        if (cfdi.getCbbUrl()!=null && !cfdi.getCbbUrl().isBlank()) {
            try {
                byte[] qrB = Base64.getDecoder().decode(cfdi.getCbbUrl().trim());
                Image qi = new Image(ImageDataFactory.create(qrB));
                qi.setWidth(95).setHeight(95);
                cQr.add(qi);
            } catch(Exception e){ log.warn("[PDF] QR: {}",e.getMessage()); }
        }
        qrSel.addCell(cQr);

        Cell cSel = new Cell().setBorder(Border.NO_BORDER).setPadding(4)
                .setVerticalAlignment(VerticalAlignment.TOP);

        cSel.add(p("SELLO DIGITAL DEL CFDI",7,true).setFontColor(NEGRO).setMarginBottom(1));
        cSel.add(pSello(selloCfd).setMarginBottom(6));

        cSel.add(p("SELLO DIGITAL DEL SAT",7,true).setFontColor(NEGRO).setMarginBottom(1));
        cSel.add(pSello(selloSat).setMarginBottom(6));

        cSel.add(p("CADENA ORIGINAL DEL COMPLEMENTO DE CERTIFICACIÓN DIGITAL DEL SAT",7,true)
                .setFontColor(NEGRO).setMarginBottom(1));
        cSel.add(pSello(cadOrig));

        qrSel.addCell(cSel);
        doc.add(qrSel.setMarginBottom(6));

        // ════════════════════════════════════════════════════════════
        // PIE FINAL — links en azul (único azul del documento)
        // ════════════════════════════════════════════════════════════
        Table pieFinal = new Table(UnitValue.createPercentArray(new float[]{50,50}))
                .setWidth(UnitValue.createPercentValue(100));
        Cell pfIzq = new Cell().setBorder(Border.NO_BORDER).setPadding(2);
        pfIzq.add(p("Facturar en línea premium® CFDI",7,false).setFontColor(NEGRO));
        pfIzq.add(p("Descargue gratis este comprobante",7,true).setFontColor(AZUL_FEL));
        pfIzq.add(p("en formato digital .XML ingresando a: fel.blikon.com/xml",7,true).setFontColor(AZUL_FEL));
        pieFinal.addCell(pfIzq);

        Cell pfDer = new Cell().setBorder(Border.NO_BORDER).setPadding(2)
                .setTextAlignment(TextAlignment.RIGHT).setVerticalAlignment(VerticalAlignment.BOTTOM);
        pfDer.add(new Paragraph()
                .add(new Text("Para Facturar en Línea ingresa a: ").setFontSize(7f).setFontColor(NEGRO))
                .add(new Text("fel.blikon.com").setFontSize(7f).setFontColor(AZUL_FEL).setBold())
                .setTextAlignment(TextAlignment.RIGHT).setMarginBottom(0));
        pieFinal.addCell(pfDer);
        doc.add(pieFinal);

        doc.add(new LineSeparator(new com.itextpdf.kernel.pdf.canvas.draw.SolidLine(0.3f))
                .setStrokeColor(NEGRO).setMarginTop(2).setMarginBottom(2));
        Table lineaFinal = new Table(UnitValue.createPercentArray(new float[]{100}))
                .setWidth(UnitValue.createPercentValue(100));
        lineaFinal.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(2)
                .setTextAlignment(TextAlignment.CENTER)
                .add(p("Este documento es una representación impresa de un CFDI.",7,true)
                        .setFontColor(NEGRO).setTextAlignment(TextAlignment.CENTER)));
        doc.add(lineaFinal);

        // ── Numeración REAL de páginas (Página X de Y) ──────────────
        // Se estampa al final, cuando ya se conoce el total de páginas.
        // Así funciona bien cuando los conceptos brincan a 2+ hojas.
        int totalPags = pdfDoc.getNumberOfPages();
        for (int pg = 1; pg <= totalPags; pg++) {
            doc.showTextAligned(
                    new Paragraph("Página " + pg + " de " + totalPags)
                            .setFontSize(7).setBold().setFontColor(NEGRO),
                    pdfDoc.getPage(pg).getPageSize().getWidth() - 20, 8,
                    pg, TextAlignment.RIGHT, VerticalAlignment.BOTTOM, 0);
        }

        doc.close();
        return baos.toByteArray();
    }

    // ── Párrafos helper ───────────────────────────────────────────────────

    /** Texto negro. */
    private Paragraph p(String txt, float size, boolean bold) {
        Paragraph par = new Paragraph(txt!=null?txt:"")
                .setFontSize(size).setFontColor(NEGRO).setMarginBottom(1).setMultipliedLeading(1.2f);
        if (bold) par.setBold();
        return par;
    }

    /** Valor de la columna derecha del header (negro, alineado derecha). */
    private Paragraph pVal(String txt) {
        return new Paragraph(txt!=null?txt:"")
                .setFontSize(7).setFontColor(NEGRO)
                .setTextAlignment(TextAlignment.RIGHT)
                .setMarginBottom(2).setMultipliedLeading(1.1f);
    }

    /**
     * Párrafo para sellos y cadena original: cadenas base64 larguísimas
     * SIN espacios. iText por defecto solo corta línea en espacios/guiones,
     * por lo que estas cadenas se salían del margen derecho de la hoja.
     * BreakAllSplitCharacters le permite a iText cortar en CUALQUIER
     * carácter, envolviendo el texto en varias líneas dentro de la celda
     * — igual que en el PDF original de FEL.
     */
    private Paragraph pSello(String txt) {
        Paragraph par = new Paragraph(txt != null ? txt : "")
                .setFontSize(5).setFontColor(NEGRO)
                .setMarginBottom(1).setMultipliedLeading(1.2f);
        par.setProperty(Property.SPLIT_CHARACTERS, new BreakAllSplitCharacters());
        return par;
    }

    /** Label negro bold, alineado a la derecha (columna derecha del header). */
    private Paragraph pLabel(String txt) {
        return new Paragraph(txt!=null?txt:"")
                .setFontSize(7.5f).setBold().setFontColor(NEGRO)
                .setTextAlignment(TextAlignment.RIGHT)
                .setMarginBottom(0).setMultipliedLeading(1.1f);
    }

    // ── Helpers XML ───────────────────────────────────────────────────────

    private Element fe(org.w3c.dom.Document xml, String name) {
        NodeList nl=xml.getElementsByTagNameNS("*",name);
        if(nl.getLength()>0) return (Element)nl.item(0);
        nl=xml.getElementsByTagName("cfdi:"+name);
        if(nl.getLength()>0) return (Element)nl.item(0);
        nl=xml.getElementsByTagName(name);
        return nl.getLength()>0?(Element)nl.item(0):null;
    }

    private String a(Element el, String name) {
        if(el==null) return ""; String v=el.getAttribute(name); return v!=null?v:"";
    }

    private String aF(Element el, String attr, String xml, String reg) {
        String v=a(el,attr);
        return (v!=null&&!v.isBlank())?v:rx(xml,reg+"=\"([^\"]+)\"");
    }

    private String rx(String xml, String pat) {
        try{Matcher m=Pattern.compile(pat).matcher(xml); if(m.find()) return m.group(1);}
        catch(Exception ig){}
        return "";
    }

    private BigDecimal bigD(String s) {
        try{return new BigDecimal(s.replace(",",""));}catch(Exception e){return BigDecimal.ZERO;}
    }

    private String fmtM(String s) {
        if(s==null||s.isBlank()) return "0.00";
        try{return String.format("%,.2f",new BigDecimal(s.replace(",","")));}
        catch(Exception e){return s;}
    }

    /** Cantidad siempre con 2 decimales (1.00, 0.35, 3.00). */
    private String fmtCant(String s) {
        if(s==null||s.isBlank()) return "0.00";
        try{return String.format("%.2f",new BigDecimal(s.replace(",","")));}
        catch(Exception e){return s;}
    }

    // ── Catálogos ─────────────────────────────────────────────────────────

    /** Nombre de la unidad a partir de la ClaveUnidad SAT (o atributo Unidad si viene en XML). */
    private String nombreUnidad(String clave, String unidadAttr) {
        if(unidadAttr!=null && !unidadAttr.isBlank()) return unidadAttr;
        if(clave==null) return "Pz";
        return switch(clave){
            case "H87"->"Pz";   case "MTR"->"Mts";  case "KGM"->"Kg";
            case "LTR"->"Lt";   case "GRM"->"g";    case "MTK"->"m²";
            case "XBX"->"Caja"; case "XPK"->"Paquete"; case "SET"->"Juego";
            case "E48"->"Servicio"; case "C62"->"Pieza"; case "ACT"->"Actividad";
            case "KT" ->"Kit";  case "XBG"->"Bolsa"; case "LO"->"Lote";
            default->clave;};
    }

    private String catMoneda(String c) {
        if(c==null||c.isBlank()) return "";
        return switch(c){
            case "MXN"->"MXN - Peso Mexicano";
            case "USD"->"USD - Dólar americano";
            case "EUR"->"EUR - Euro";
            case "XXX"->"XXX - Sin moneda"; default->c;};
    }

    private String catTipoComprobante(String c) {
        if(c==null||c.isBlank()) c="I";
        return switch(c){
            case "I"->"I - Ingreso"; case "E"->"E - Egreso"; case "P"->"P - Pago";
            case "T"->"T - Traslado"; case "N"->"N - Nómina"; default->c;};
    }

    private String catFPago(String c) {
        if(c==null) return "";
        return switch(c){
            case "01"->"01 - Efectivo"; case "03"->"03 - Transferencia electrónica";
            case "04"->"04 - Tarjeta de crédito"; case "28"->"28 - Tarjeta de débito";
            case "99"->"99 - Por definir"; default->c;};
    }

    private String catMPago(String c) {
        if(c==null) return "";
        return switch(c){
            case "PUE"->"PUE - Pago en una sola exhibición";
            case "PPD"->"PPD - Pago en parcialidades o diferido"; default->c;};
    }

    private String catalogRegimen(String c) {
        if(c==null||c.isBlank()) return "";
        return switch(c){
            case "601"->"General de Ley Personas Morales";
            case "612"->"Personas Físicas con Actividades Empresariales";
            case "616"->"Sin obligaciones fiscales"; case "621"->"Incorporación Fiscal";
            case "626"->"Régimen Simplificado de Confianza"; default->c;};
    }

    private String catalogUsoCfdi(String c) {
        if(c==null||c.isBlank()) return "";
        return switch(c){
            case "G01"->"Adquisición de mercancias"; case "G03"->"Gastos en general";
            case "S01"->"Sin efectos fiscales"; case "CP01"->"Pagos"; default->c;};
    }

    // ── Número a letras ───────────────────────────────────────────────────

    private String numeroALetras(String monto) {
        try{
            BigDecimal bd=new BigDecimal(monto.replace(",",""));
            long ent=bd.longValue();
            long cts=bd.subtract(BigDecimal.valueOf(ent))
                    .multiply(BigDecimal.valueOf(100)).setScale(0,RoundingMode.HALF_UP).longValue();
            String l = letras(ent).toUpperCase();
            // Gramática: "UN MILLÓN DE PESOS", pero "UN MILLÓN CIEN MIL PESOS"
            String de = (l.endsWith("MILLÓN")||l.endsWith("MILLONES")) ? " DE" : "";
            return l+de+" PESOS, "+String.format("%02d",cts)+"/100 MXN";
        }catch(Exception e){return monto+" MXN";}
    }

    private static final String[] UN={"","UN","DOS","TRES","CUATRO","CINCO","SEIS","SIETE","OCHO","NUEVE",
            "DIEZ","ONCE","DOCE","TRECE","CATORCE","QUINCE","DIECISÉIS","DIECISIETE","DIECIOCHO","DIECINUEVE"};
    private static final String[] DE={"","DIEZ","VEINTE","TREINTA","CUARENTA","CINCUENTA","SESENTA","SETENTA","OCHENTA","NOVENTA"};
    private static final String[] CE={"","CIENTO","DOSCIENTOS","TRESCIENTOS","CUATROCIENTOS","QUINIENTOS","SEISCIENTOS","SETECIENTOS","OCHOCIENTOS","NOVECIENTOS"};

    private String letras(long n) {
        if(n==0) return "CERO"; if(n<0) return "MENOS "+letras(-n);
        if(n==100) return "CIEN"; if(n<20) return UN[(int)n];
        if(n<100) return DE[(int)(n/10)]+(n%10>0?" Y "+UN[(int)(n%10)]:"");
        if(n<1000) return CE[(int)(n/100)]+(n%100>0?" "+letras(n%100):"");
        if(n<1000000){long m=n/1000,r=n%1000;return(m==1?"MIL":letras(m)+" MIL")+(r>0?" "+letras(r):"");}
        if(n<1000000000000L){long m=n/1000000,r=n%1000000;
            return(m==1?"UN MILLÓN":letras(m)+" MILLONES")+(r>0?" "+letras(r):"");}
        return String.valueOf(n);
    }
}