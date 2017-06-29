# frozen_string_literal: true
require "rails_helper"

describe "dashboard/autoyast" do
  context "when proxy is enabled" do
    let(:http_proxy) { "squid.corp.net:3128" }
    let(:https_proxy) { "squid.corp.net:3443" }
    let(:no_proxy) { "localhost" }

    before do
      assign(:proxy_http, http_proxy)
      assign(:proxy_https, https_proxy)
      assign(:proxy_no_proxy, no_proxy)
      assign(:proxy_systemwide, true)
    end

    it "generates a proxy section" do
      render

      check_xml_text_node("profile/networking/proxy/http_proxy", http_proxy)
      check_xml_text_node("profile/networking/proxy/https_proxy", https_proxy)
      check_xml_text_node("profile/networking/proxy/no_proxy", no_proxy)
    end

    it "generates a post partitioning script" do
      render

      matches = assert_select("scripts/chroot-scripts/script")
      expect(matches.find { |m| m.to_s.include?("set_proxy.sh") }).not_to be_nil
    end
  end

  context "when proxy is not enabled" do
    before do
      assign(:proxy_systemwide, false)
    end

    it "does not generate a proxy script" do
      render

      matches = assert_select("scripts/chroot-scripts/script")
      expect(matches.find { |m| m.to_s.include?("set_proxy.sh") }).to be_nil
    end

    it "does not generate a proxy section" do
      render

      assert_select("profile/networking/proxy", false)
    end

  end

  def check_xml_text_node(xpath, value)
    section = assert_select xpath
    expect(section.children.text).to eq(value)
  end

end
