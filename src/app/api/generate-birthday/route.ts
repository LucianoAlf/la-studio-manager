import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const CANVA_API = "https://api.canva.com/rest/v1";
const TEMPLATE_ID = "DAHFO425zfc";

// Element IDs from the Canva template
const NAME_ELEMENT_ID = "PBfJv6jQy0nhTC0s-LBWjGMbR30528Q1B"; // Visible name (was "ALF")
const PHOTO_ELEMENT_ID = "PBfJv6jQy0nhTC0s-LBFhcKBzcKfkr0sq"; // Photo in polaroid

export async function POST(req: NextRequest) {
  try {
    const { assetId, brand } = await req.json();

    if (!assetId || !brand) {
      return NextResponse.json({ success: false, error: "Missing assetId or brand" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Get student data
    const { data: student, error: studentErr } = await supabase
      .from("assets" as never)
      .select("id, person_name, file_url, metadata")
      .eq("id", assetId)
      .single();

    if (studentErr || !student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const studentData = student as { id: string; person_name: string; file_url: string; metadata: Record<string, unknown> };
    const firstName = (studentData.person_name || "Aluno").split(" ")[0];

    // 2. Get Canva credentials
    const { data: canvaCred } = await supabase
      .from("integration_credentials" as never)
      .select("credentials")
      .eq("integration_name", "canva")
      .single();

    const credData = canvaCred as { credentials?: { access_token?: string; refresh_token?: string; expires_at?: number } } | null;
    let accessToken = credData?.credentials?.access_token;

    if (!accessToken) {
      return NextResponse.json({ success: false, error: "Canva credentials not found" }, { status: 500 });
    }

    // Refresh token if needed
    if (credData?.credentials?.expires_at && Date.now() > credData.credentials.expires_at - 300000) {
      const refreshed = await refreshCanvaToken(credData.credentials.refresh_token || "");
      if (refreshed) {
        accessToken = refreshed.access_token;
        await supabase
          .from("integration_credentials" as never)
          .update({
            credentials: {
              ...credData.credentials,
              access_token: refreshed.access_token,
              expires_at: Date.now() + refreshed.expires_in * 1000,
            },
          } as never)
          .eq("integration_name", "canva");
      }
    }

    console.log(`[BIRTHDAY-CANVA] Generating for ${studentData.person_name}`);

    // 3. Upload student photo to Canva (if has real photo)
    let photoAssetId: string | null = null;
    if (studentData.metadata?.has_real_photo && studentData.file_url) {
      console.log("[BIRTHDAY-CANVA] Uploading student photo...");
      photoAssetId = await uploadAssetToCanva(accessToken, studentData.file_url, `bday-${studentData.id}-${Date.now()}`);
    }

    // 4. Start editing transaction
    console.log("[BIRTHDAY-CANVA] Starting editing transaction...");
    const startRes = await canvaFetch(accessToken, `/designs/${TEMPLATE_ID}/editing_sessions`, "POST", {});
    if (!startRes?.transaction?.transaction_id) {
      // Try alternative endpoint
      const startRes2 = await canvaFetch(accessToken, `/designs/${TEMPLATE_ID}/content/editing_sessions`, "POST", {});
      if (!startRes2?.transaction?.transaction_id) {
        console.error("[BIRTHDAY-CANVA] Failed to start editing:", JSON.stringify(startRes), JSON.stringify(startRes2));
        return NextResponse.json({ success: false, error: "Failed to start Canva editing session" }, { status: 500 });
      }
      Object.assign(startRes, startRes2);
    }

    const txId = startRes.transaction.transaction_id;
    console.log(`[BIRTHDAY-CANVA] Transaction: ${txId}`);

    try {
      // 5. Replace name text
      const operations: Record<string, unknown>[] = [
        { type: "replace_text", element_id: NAME_ELEMENT_ID, text: firstName.toUpperCase() },
      ];

      // Replace photo if we uploaded one
      if (photoAssetId) {
        operations.push({
          type: "update_fill",
          element_id: PHOTO_ELEMENT_ID,
          asset_type: "image",
          asset_id: photoAssetId,
          alt_text: `Foto de ${studentData.person_name}`,
        });
      }

      console.log("[BIRTHDAY-CANVA] Performing edits...");
      const editRes = await canvaFetch(accessToken, `/designs/${TEMPLATE_ID}/editing_sessions/${txId}/operations`, "POST", {
        operations,
        page_index: 1,
      });

      if (!editRes) {
        throw new Error("Edit operations failed");
      }

      // 6. Commit
      console.log("[BIRTHDAY-CANVA] Committing...");
      await canvaFetch(accessToken, `/designs/${TEMPLATE_ID}/editing_sessions/${txId}/commit`, "POST", {});

      // 7. Export design
      console.log("[BIRTHDAY-CANVA] Exporting...");
      const exportUrl = await exportDesign(accessToken, TEMPLATE_ID);

      if (!exportUrl) {
        throw new Error("Export failed");
      }

      // 8. Download and upload to Supabase Storage
      console.log("[BIRTHDAY-CANVA] Downloading export...");
      const imgRes = await fetch(exportUrl);
      if (!imgRes.ok) throw new Error("Failed to download exported image");
      const imgBlob = await imgRes.blob();

      const storagePath = `birthday-posts/${brand}/${studentData.id}-${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage
        .from("posts")
        .upload(storagePath, imgBlob, { contentType: "image/png", upsert: true });

      if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage.from("posts").getPublicUrl(storagePath);
      const finalUrl = urlData.publicUrl;

      // 9. Log
      await supabase.from("birthday_automation_log" as never).insert({
        student_id: studentData.id,
        student_name: studentData.person_name,
        brand,
        image_url: finalUrl,
        approval_status: "pending",
        metadata: { method: "canva_editing", generated_at: new Date().toISOString() },
      } as never);

      console.log(`[BIRTHDAY-CANVA] Success! ${finalUrl}`);

      // 10. Clean up: restore template to blank state
      await restoreTemplate(accessToken);

      return NextResponse.json({
        success: true,
        image_url: finalUrl,
        student_name: studentData.person_name,
      });
    } catch (editErr) {
      // If editing fails, try to cancel the transaction
      console.error("[BIRTHDAY-CANVA] Edit error, cancelling:", editErr);
      await canvaFetch(accessToken, `/designs/${TEMPLATE_ID}/editing_sessions/${txId}/cancel`, "POST", {});
      throw editErr;
    }
  } catch (err) {
    console.error("[BIRTHDAY-CANVA] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Restore template to clean state (blank name, default photo)
async function restoreTemplate(accessToken: string) {
  try {
    const startRes = await canvaFetch(accessToken, `/designs/${TEMPLATE_ID}/editing_sessions`, "POST", {});
    if (!startRes?.transaction?.transaction_id) return;

    const txId = startRes.transaction.transaction_id;
    await canvaFetch(accessToken, `/designs/${TEMPLATE_ID}/editing_sessions/${txId}/operations`, "POST", {
      operations: [{ type: "replace_text", element_id: NAME_ELEMENT_ID, text: " " }],
      page_index: 1,
    });
    await canvaFetch(accessToken, `/designs/${TEMPLATE_ID}/editing_sessions/${txId}/commit`, "POST", {});
    console.log("[BIRTHDAY-CANVA] Template restored to clean state");
  } catch {
    console.warn("[BIRTHDAY-CANVA] Failed to restore template (non-critical)");
  }
}

// Canva API helper
async function canvaFetch(accessToken: string, path: string, method: string, body: unknown) {
  const res = await fetch(`${CANVA_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[CANVA] ${method} ${path} failed: ${res.status} ${text}`);
    return null;
  }

  return res.json();
}

// Upload photo to Canva
async function uploadAssetToCanva(accessToken: string, imageUrl: string, name: string): Promise<string | null> {
  const res = await canvaFetch(accessToken, "/asset-uploads", "POST", { url: imageUrl, name });
  if (!res) return null;

  if (res.job?.id) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await canvaFetch(accessToken, `/asset-uploads/${res.job.id}`, "GET", null);
      if (status?.job?.status === "success") return status.job.asset?.id;
      if (status?.job?.status === "failed") return null;
    }
  }

  return res.asset?.id || null;
}

// Export design as PNG
async function exportDesign(accessToken: string, designId: string): Promise<string | null> {
  const res = await canvaFetch(accessToken, "/exports", "POST", {
    design_id: designId,
    format: { type: "png" },
  });

  if (!res?.job?.id) return null;

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await canvaFetch(accessToken, `/exports/${res.job.id}`, "GET", null);
    if (status?.job?.status === "success") {
      const urls = status.job?.urls || status.job?.result?.urls;
      if (urls?.length > 0) return urls[0];
    }
    if (status?.job?.status === "failed") return null;
  }

  return null;
}

// Refresh Canva token
async function refreshCanvaToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(`${CANVA_API}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  if (!res.ok) return null;
  return res.json();
}
