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
  end

  def check_xml_text_node(xpath, value)
    section = assert_select xpath
    expect(section.children.text).to eq(value)
  end
end
