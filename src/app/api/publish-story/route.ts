import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, brand, studentName } = await req.json();

    if (!imageUrl || !brand || !studentName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get Instagram credentials (same pattern as publish-scheduled-posts edge function)
    const integrationName = brand === "la_music_kids" ? "instagram_kids" : "instagram_school";

    const { data: cred, error: credError } = await supabase
      .from("integration_credentials" as never)
      .select("credentials")
      .eq("integration_name", integrationName)
      .eq("is_active", true)
      .single();

    if (credError || !cred) {
      console.error("[PUBLISH-STORY] Credentials error:", credError);
      return NextResponse.json(
        { success: false, error: "Instagram credentials not found" },
        { status: 500 }
      );
    }

    const credData = cred as { credentials?: { access_token?: string; instagram_account_id?: string } };
    const accessToken = credData.credentials?.access_token;
    const igAccountId = credData.credentials?.instagram_account_id;

    if (!accessToken || !igAccountId) {
      return NextResponse.json(
        { success: false, error: "Instagram token or account ID not configured" },
        { status: 500 }
      );
    }

    console.log(`[PUBLISH-STORY] Creating story for ${studentName} on ${brand} (account: ${igAccountId})`);

    // Create STORY container using URLSearchParams (form-encoded, same as working edge function)
    const containerParams = new URLSearchParams({
      access_token: accessToken,
      media_type: "STORIES",
      image_url: imageUrl,
    });

    const createRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}/media`,
      { method: "POST", body: containerParams }
    );

    const createData = await createRes.json();
    console.log("[PUBLISH-STORY] Create response:", JSON.stringify(createData));

    if (!createData.id) {
      return NextResponse.json(
        { success: false, error: `Container failed: ${JSON.stringify(createData)}` },
        { status: 400 }
      );
    }

    // Image stories are near-instant — wait 3s (same as working edge function)
    console.log("[PUBLISH-STORY] Image story — waiting 3s...");
    await new Promise((r) => setTimeout(r, 3000));

    // Publish using URLSearchParams
    const publishParams = new URLSearchParams({
      creation_id: createData.id,
      access_token: accessToken,
    });

    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}/media_publish`,
      { method: "POST", body: publishParams }
    );

    const publishData = await publishRes.json();
    console.log("[PUBLISH-STORY] Publish response:", JSON.stringify(publishData));

    if (!publishData.id) {
      return NextResponse.json(
        { success: false, error: `Publish failed: ${JSON.stringify(publishData)}` },
        { status: 400 }
      );
    }

    // Update birthday_automation_log
    await supabase
      .from("birthday_automation_log" as never)
      .update({
        approval_status: "published",
        published_at: new Date().toISOString(),
      } as never)
      .eq("student_name", studentName)
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    console.log(`[PUBLISH-STORY] Success! Post ID: ${publishData.id}`);

    return NextResponse.json({
      success: true,
      post_id: publishData.id,
    });
  } catch (err) {
    console.error("[PUBLISH-STORY] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
